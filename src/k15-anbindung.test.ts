// K15 Teil 3 · wie viel Fleet mitkommt (Auftrag k15-runde-16-10-vormittag.md §3 auf bau/neuaufbau): ein Regler von „nur der Ordner“ bis
// „volle Anbindung“; jede Stufe zeigt, welche Bausteine dazukommen.
import { describe, expect, test } from "bun:test";
import type { Answer, Baustein } from "./founding";
import { ANBINDUNGEN, IMMER, anbindungRolle, anbindungSchalter, ankommend, bereinigt, fleetTeil, unterschied } from "./k15-anbindung";

const baustein = (id: string, funktion: string, o: Partial<Baustein> = {}): Baustein => ({ id, wort: id, satz: "", funktion: [funktion], grenze: { art: "frei" },
  schicht: "", zustand: "an", quelle: "default", rollenDefault: "an", harness: { gueltig: true, grund: null }, schaltbar: { ja: true }, bytes: "unknown",
  ersatzKandidaten: [], ...o });
const noetig: Partial<Baustein> = { grenze: { art: "noetig", grund: "Vertrag", gesperrt: true } };
function plan(bs: Baustein[], geliefert: string[] | null, omitted: string[] = [], refusals: string[] = []): Answer {
  return { selected: [], omitted: omitted.map((id) => ({ id, reason: "missing-source" })), sessionAgents: { text: "", bytes: 0, parts: [] },
    plan: { planHash: "h", planSatz: "", rolle: "lane", harness: "claude", modell: null, effort: null, ort: { art: "repo", pfad: "/r", branch: "main", head: "x" },
      bytesVorAuftrag: { bytes: 0, unknown: [], auftrag: [] }, bausteine: bs },
    rollen: [], start: { tuer: "open", startbar: true, refusals },
    ...(geliefert ? { lieferung: { tuer: "lane", geliefert: geliefert.map((id) => ({ id, weg: "Session-Datei" })), ausgelassen: [] } } : {}) };
}

// die Lane in klein: Pflicht in drei Gruppen, ein freier Baustein je Gruppe, dazu was sich dazuschalten lässt
const LANE = [
  baustein("spawn-profile", "orientierung", noetig),
  baustein("portable-contract", "vertrag", { ...noetig, enthaltenIn: "context-anchors" }),
  baustein("private-rulebook", "vertrag"),
  baustein("task-brief", "auftrag", noetig),
  baustein("lane-footer", "rueckweg", noetig),
  baustein("delivery-header", "beweis"),
  baustein("context-anchors", "orientierung"),
  baustein("lane-notes", "orientierung"),
  baustein("source-code", "orientierung", { zustand: "aus" }),
  baustein("pack:jev-use", "orientierung", { zustand: "aus" }),
  baustein("pack:ohne-quelle", "orientierung", { zustand: "aus" }),
  baustein("source-pointers", "orientierung", { zustand: "aus", bedingung: { erfuellt: false, grund: "nur mit Karte" } }),
  baustein("memory-pointer", "gedaechtnis-zeiger"),
  baustein("auto-memory", "orientierung", { zustand: "aus", schaltbar: { ja: false, grund: "native" } }),
];
const voll = plan(LANE, null, ["ohne-quelle"]);

describe("die vier Stufen", () => {
  test("von „Nur Ordner“ bis „Alles“, je ein Wort und ein Satz", () => {
    expect(ANBINDUNGEN.map((x) => x.wort)).toEqual(["Nur Ordner", "Pflicht", "Standard", "Alles"]);
    expect(ANBINDUNGEN.every((x) => x.satz.length > 20 && !x.satz.includes("\n"))).toBe(true);
  });
  test("„Nur Ordner“ startet ohne Rolle, jede andere Stufe mit der Rolle", () => {
    expect(ANBINDUNGEN.map((x) => anbindungRolle(x.id, "lane"))).toEqual(["nur-ordner", "lane", "lane", "lane"]);
    expect(anbindungRolle("pflicht", "main")).toBe("main");
  });
  test("„Nur Ordner“ und „Standard“ schalten nichts: der Plan ohne Rolle bzw. der Plan der Rolle", () => {
    expect([anbindungSchalter("ordner", voll), anbindungSchalter("standard", voll)]).toEqual([{}, {}]);
  });
  test("„Pflicht“ schaltet jeden freien Baustein aller Gruppen aus, nie eine Pflicht und nie, was eine Pflicht trägt", () => {
    expect(anbindungSchalter("pflicht", voll)).toEqual({ "private-rulebook": "aus", "delivery-header": "aus", "lane-notes": "aus", "memory-pointer": "aus" });
  });
  test("„Alles“ schaltet an, was der Server annimmt: nichts mit unerfüllter Bedingung, kein Pack ohne Quelle, nichts Unschaltbares", () => {
    expect(anbindungSchalter("alles", voll)).toEqual({ "source-code": "an", "pack:jev-use": "an" });
  });
  test("ein leerer Plan schaltet auf keiner Stufe etwas", () => {
    expect(ANBINDUNGEN.map((x) => anbindungSchalter(x.id, plan([], null)))).toEqual([{}, {}, {}, {}]);
  });
});

describe("was ankommt und was sich zwischen zwei Stufen ändert", () => {
  const ordner = plan([baustein("native-agents", "vertrag"), baustein("auto-memory", "orientierung"), baustein("spawn-profile", "orientierung")],
    ["native-agents", "auto-memory", "spawn-profile"]);
  const pflicht = plan([...LANE, baustein("native-agents", "vertrag"), { ...baustein("auto-memory", "orientierung"), zustand: "aus" }],
    ["spawn-profile", "portable-contract", "lane-footer", "context-anchors", "native-agents"]);
  test("ankommen heißt geliefert: was an ist, aber die Tür nicht liefert (Auftrag ohne Karte), kommt nicht an; die Einstellungen zählen nicht", () => {
    expect([...ankommend(pflicht)]).toEqual(["portable-contract", "lane-footer", "context-anchors", "native-agents"]);
  });
  test("ohne Auskunft der Tür zählt, was an ist", () => {
    expect([...ankommend(plan([baustein("a", "vertrag"), baustein("b", "vertrag", { zustand: "aus" })], null))]).toEqual(["a"]);
  });
  test("von „Nur Ordner“ zu „Pflicht“: Vertrag, Rückweg und Lesehinweise kommen dazu, Claudes eigenes Gedächtnis fällt weg; was an ist, aber die Tür nicht liefert, steht für sich", () => {
    expect(unterschied(ordner, pflicht)).toEqual({ dazu: ["portable-contract", "lane-footer", "context-anchors"], weg: ["auto-memory"],
      nichtJetzt: ["private-rulebook", "task-brief", "delivery-header", "lane-notes", "memory-pointer"] });
  });
  test("dieselbe Stufe zweimal: nichts dazu, nichts weg, nichts neu angeschaltet", () => {
    expect(unterschied(pflicht, pflicht)).toEqual({ dazu: [], weg: [], nichtJetzt: [] });
  });
  test("was die Tür trotz „aus“ im Plan liefert, kommt an; eine Absage anderer Form schaltet nichts frei", () => {
    const p = plan([baustein("delivery-header", "beweis", { zustand: "aus" }), baustein("source-code", "orientierung"), baustein("self-credential", "rueckweg", { zustand: "aus" })], [],
      [], ["delivery-header ist im Plan aus, diese Tuer liefert es trotzdem (Zustellung)", "source-code ist angeschaltet, diese Tuer liefert es nicht: nur die Dispatch-Gruendung einer Karte liefert das"]);
    expect([...ankommend(p)]).toEqual(["delivery-header"]);
  });
  test("von „Standard“ zu „Alles“: der Quellcode ist an, kommt ohne Karte aber nicht an; was schon unten an war und nicht ankam, zählt nicht neu", () => {
    // die Einstellungen sind wie ohne Rolle unten aus und oben an: sie trägt jeder Start, sie sind keine Stufe
    const std = plan([baustein("spawn-profile", "orientierung", { ...noetig, zustand: "aus" }), baustein("lane-footer", "rueckweg", noetig), baustein("task-brief", "auftrag", noetig),
      baustein("source-code", "orientierung", { zustand: "aus" })], ["spawn-profile", "lane-footer"]);
    const alles = plan([baustein("spawn-profile", "orientierung", noetig), baustein("lane-footer", "rueckweg", noetig), baustein("task-brief", "auftrag", noetig),
      baustein("source-code", "orientierung")], ["lane-footer"]);
    expect(unterschied(std, alles)).toEqual({ dazu: [], weg: [], nichtJetzt: ["source-code"] });
  });
});

describe("was Fleet dazugibt, in Tokens", () => {
  const summe = (fleetBytes: number, fleetUnbekannt: string[]) => ({ fleetBytes, fleetUnbekannt, fleetTokens: 0, bytesJeToken: { wert: 2, quelle: "q" }, claudeCodeTokens: 100, tokens: 0 });
  const mit = (a: Answer, s: ReturnType<typeof summe>): Answer => ({ ...a, startSumme: s });
  test("ohne Start-Summe (älterer Server) keine Zahl", () => {
    expect(fleetTeil(plan([], null))).toBe(null);
  });
  test("die Dateien des Repos, die Claude Code selbst lädt, zählen nicht zu Fleet: „Nur Ordner“ gibt nichts dazu", () => {
    const ordner = plan([baustein("native-agents", "vertrag", { bytes: 8000 })], ["native-agents"]);
    expect(fleetTeil(mit(ordner, summe(8000, [])))).toEqual({ tokens: 0, offen: [] });
  });
  test("die Lane: Fleets Bytes zum Verhältnis des Servers; was nicht gemessen ist, wird genannt, die Repo-Dateien nicht", () => {
    const lane = plan([baustein("native-agents", "vertrag"), baustein("lane-footer", "rueckweg", { bytes: 3000 }), baustein("portable-contract", "vertrag")],
      ["native-agents", "lane-footer", "portable-contract"]);
    expect(fleetTeil(mit(lane, summe(3001, ["portable-contract", "native-agents"])))).toEqual({ tokens: 1501, offen: ["portable-contract"] });
  });
  test("gemessene Repo-Dateien, die die Tür nicht liefert, zieht nichts ab (der Server hat sie nicht gezählt)", () => {
    const p = plan([baustein("native-agents", "vertrag", { bytes: 8000, zustand: "aus" }), baustein("lane-footer", "rueckweg", { bytes: 3000 })], ["lane-footer"]);
    expect(fleetTeil(mit(p, summe(3000, [])))).toEqual({ tokens: 1500, offen: [] });
  });
});

describe("was die Tür nicht einhält, nimmt die Stufe heraus", () => {
  const TROTZ = "delivery-header ist im Plan aus, diese Tuer liefert es trotzdem (Zustellung)";
  const NIE = "source-code ist angeschaltet, diese Tuer liefert es nicht: nur die Dispatch-Gruendung einer Karte liefert das";
  const mit = (refusals: string[]) => plan([], null, [], refusals);
  test("„Pflicht“: was die Tür immer liefert, bleibt an; der Rest der Schalter bleibt, wie er war", () => {
    expect(bereinigt({ "delivery-header": "aus", "lane-notes": "aus" }, mit([TROTZ]))).toEqual({ schalter: { "lane-notes": "aus" }, abgelehnt: [{ id: "delivery-header", grund: IMMER }] });
  });
  test("„Alles“: was nur eine Karte liefert, bleibt aus, mit dem Grund des Servers", () => {
    expect(bereinigt({ "source-code": "an", "pack:jev-use": "an" }, mit([NIE]))).toEqual({ schalter: { "pack:jev-use": "an" },
      abgelehnt: [{ id: "source-code", grund: "nur die Dispatch-Gruendung einer Karte liefert das" }] });
  });
  test("eine Absage über einen Baustein, den die Stufe nicht schaltet (die Tür des Ordners liefert trotzdem), nimmt nichts heraus", () => {
    expect(bereinigt({ "lane-notes": "aus" }, mit([TROTZ, NIE]))).toEqual({ schalter: { "lane-notes": "aus" }, abgelehnt: [] });
  });
  test("eine Absage passt nur zur Richtung des Schalters: „trotzdem“ zu aus, „liefert es nicht“ zu an", () => {
    expect(bereinigt({ "delivery-header": "an", "source-code": "aus" }, mit([TROTZ, NIE])).abgelehnt).toEqual([]);
  });
  test("ohne Absage bleibt alles", () => {
    expect(bereinigt({ a: "aus" }, mit([]))).toEqual({ schalter: { a: "aus" }, abgelehnt: [] });
  });
});

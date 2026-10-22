// NEUE SESSION, EINE ORDNUNG (src/sitzung-modell.ts): jeder Teil steht unter der Frage, die der Server ihm gibt; Summen, Herkunft, Stand und
// Schalter folgen dem Plan; die Tür, die trotz „aus“ liefert, zählt als „an“; das Ziel eines Branches ist der Auftrag
import { describe, expect, test } from "bun:test";
import type { Answer, Baustein } from "./founding";
import { PLATZ, platzVon, sitzungModell, type Eingaben } from "./sitzung-modell";

const baustein = (id: string, o: Partial<Baustein> = {}): Baustein => ({ id, wort: id, satz: "", funktion: ["vertrag"], grenze: { art: "frei" },
  schicht: "", zustand: "aus", quelle: "default", rollenDefault: "aus", harness: { gueltig: true, grund: null },
  schaltbar: { ja: false, grund: "Nur Ordner liefert nur native-agents und auto-memory." }, bytes: "unknown", ersatzKandidaten: [], ...o });
const teil = (name: string, bytes: number | null, frage: string, o: Record<string, unknown> = {}) =>
  ({ name, bytes, stand: "an", weg: "mitgeliefert", satz: "s", text: `# ${name}\ntext`, frage, ...o });
const ANATOMIE = { quelle: { slot: 1, rolle: "x", ort: "o", claude: "2", modell: null, seit: 1, tokens: 1000, bytesJeToken: 2.5 }, grund: null, gruppen: [
  { id: "systemprompt", wort: "S", satz: "s", teile: [teil("Environment", 250, "umstaende"), teil("Memory", 500, "hintergrund"), teil("Regeln", 1000, "howto")] },
  { id: "fleet", wort: "F", satz: "s", teile: [teil("Listenschnitt", 210, "howto", { weg: "--append-system-prompt" }), teil("Auto-Mode", 42, "umstaende", { weg: "--append-system-prompt" }),
    teil("Gepflogenheiten", null, "howto", { stand: "aus", text: undefined })] },
  { id: "werkzeuge", wort: "W", satz: "s", teile: [teil("Read", 500, "umstaende"), teil("Cron", 10, "umstaende", { stand: "abruf" }), teil("Agent", 900, "umstaende", { stand: "aus" })] },
] };
function antwort(bs: Baustein[], refusals: string[] = []): Answer {
  return { selected: [], omitted: [{ id: "jev-use", reason: "source-unavailable" }], sessionAgents: null,
    plan: { planHash: "h", planSatz: "", rolle: "nur-ordner", harness: "claude", modell: null, effort: null, ort: { art: "ordner", pfad: "/r", branch: "main", head: "x" },
      bytesVorAuftrag: { bytes: 0, unknown: [], auftrag: [] }, bausteine: bs },
    rollen: [], start: { tuer: "open", startbar: refusals.length === 0, refusals },
    claudeCode: { rolle: "generic", zeilen: [], messung: { rolle: "generic", tokens: 40000, am: "", claude: "", modell: "", quelle: "q", gilt: true }, anatomie: ANATOMIE } as Answer["claudeCode"],
    startSumme: { fleetBytes: 0, fleetUnbekannt: [], fleetTokens: 0, bytesJeToken: { wert: 2, quelle: "q" }, claudeCodeTokens: 40000, tokens: 0 } };
}
const ein = (o: Partial<Eingaben> = {}): Eingaben => ({ rolle: "einfach", auftrag: "", slot: 7, dateien: new Map(), ...o });
const OMIT = { "source-unavailable": "Die Quelle des Packs liegt nicht in diesem Repo." };
const modell = (a: Answer, e = ein()) => sitzungModell(a, e, (b) => `Wort ${b.id}`, OMIT);

describe("die Frage kommt vom Server", () => {
  test("Claude Codes Abschnitte stehen unter ihrer Frage, je Frage eine Zeile, je Abschnitt ein Block", () => {
    const m = modell(antwort([]));
    expect(m.teile.find((t) => t.id === "sys-umstaende")?.frage).toBe("umstaende");
    expect(m.teile.find((t) => t.id === "sys-hintergrund")?.frage).toBe("hintergrund");
    expect(m.teile.find((t) => t.id === "sys-howto")?.frage).toBe("howto");
    expect(m.bloecke.filter((b) => b.ort === "system" && b.herkunft === "cc").map((b) => b.frage)).toEqual(["umstaende", "hintergrund", "howto"]);
  });
  test("ein Baustein steht unter der Frage seines Registers, nicht unter einer festen Liste des Fensters", () => {
    const m = modell(antwort([baustein("lane-notes", { frage: "hintergrund" }), baustein("konzept-x", { frage: "konzepte" })]));
    expect(m.teile.find((t) => t.id === "lane-notes")?.frage).toBe("hintergrund");
    expect(m.teile.find((t) => t.id === "konzept-x")?.frage).toBe("konzepte");
  });
});

describe("Tokens und Herkunft", () => {
  test("Claude Codes Teil zum Verhältnis der Quelle, Fleets Anhang zu Fleets; Abgeschaltetes zählt nicht, Abruf mit seinem Namen", () => {
    const m = modell(antwort([]));
    // Environment 250/2,5 = 100 · Auto-Mode 42/2 = 21 · Werkzeuge (500 + 10)/2,5 = 204, Agent (aus) nicht
    expect(m.summe.je.umstaende).toBe(100 + 21 + 204);
    expect(m.summe.herkunft.umstaende.fleet).toBe(21);
    expect(m.summe.fleet).toBe(21 + 210 / 2);
    expect(m.teile.find((t) => t.fach === "Gepflogenheiten")?.stand).toBe("aus");
  });
  test("ein Teil heißt in Alltagswörtern, der Fachbegriff bleibt daneben; ohne Übersetzung bleibt der Name", () => {
    const m = modell(antwort([baustein("self-credential", { frage: "umstaende" }), baustein("lesehilfe", { frage: "konzepte" })]));
    expect(m.teile.find((t) => t.id === "self-credential")).toMatchObject({ name: "Ausweis für Fleet", fach: "Wort self-credential" });
    expect(m.teile.find((t) => t.id === "lesehilfe")).toMatchObject({ name: "Wort lesehilfe", fach: null });
    expect(m.teile.find((t) => t.fach === "Listenschnitt")?.name).toBe("Gekürzte Liste der Skills");
  });
  test("die Summe ist die Summe der Zeilen", () => {
    const m = modell(antwort([baustein("delivery-header", { frage: "umstaende", zustand: "an", bytes: 40 })]));
    expect(m.summe.alle).toBeCloseTo(m.teile.reduce((n, t) => n + t.tokens, 0), 6);
  });
});

describe("Stand und Schalter folgen dem Plan", () => {
  test("was die Tür trotz „aus“ liefert, steht als an, ohne Schalter und mit dem Weg als Grund", () => {
    const m = modell(antwort([baustein("delivery-header", { frage: "umstaende", schaltbar: { ja: true } })],
      ["delivery-header ist im Plan aus, diese Tuer liefert es trotzdem (Zustellung)"]));
    const t = m.teile.find((x) => x.id === "delivery-header");
    expect(t?.stand).toBe("an");
    expect(t?.schalter).toBe(null);
    expect(t?.fest).toBe("Kommt bei jedem Start mit, im Kopf jeder Nachricht; abschalten geht noch nicht.");
    expect(m.bloecke.find((b) => b.id === "delivery-header")?.text).toBe("[fleet-zustellung · Owner-Credential · Slot 7]");
  });
  test("ein schaltbarer Baustein trägt seinen Schalter; aus heißt: sein Block ist nicht im Start", () => {
    const an = modell(antwort([baustein("lane-notes", { frage: "hintergrund", zustand: "an", schaltbar: { ja: true }, bytes: 100 })]));
    expect(an.teile.find((t) => t.id === "lane-notes")?.schalter).toEqual({ baustein: "lane-notes", an: true });
    const aus = modell(antwort([baustein("lane-notes", { frage: "hintergrund", zustand: "aus", schaltbar: { ja: true }, bytes: 100 })]));
    expect(aus.teile.find((t) => t.id === "lane-notes")?.schalter).toEqual({ baustein: "lane-notes", an: false });
    expect(aus.teile.find((t) => t.id === "lane-notes")?.tokens).toBe(0);
    expect(aus.bloecke.find((b) => b.id === "lane-notes")?.text).toBe(null);
  });
  test("was an ist, steht im Text, auch ohne Wortlaut vom Server; seine Tokens bleiben die gemessenen", () => {
    const m = modell(antwort([baustein("portable-contract", { frage: "howto", bytes: 420 })],
      ["portable-contract ist im Plan aus, diese Tuer liefert es trotzdem (native Datei)"]));
    expect(m.teile.find((t) => t.id === "portable-contract")?.stand).toBe("an");
    expect(m.teile.find((t) => t.id === "portable-contract")?.tokens).toBe(420 / 2);
    // der Text nennt den Teil, wie die Übersicht ihn nennt (Owner 09:5x: Alltagswörter), und er landet, wo die Tür ihn hinlegt
    expect(m.bloecke.find((b) => b.id === "portable-contract")?.text).toBe("Grundregeln von Fleet: kommt in den Start (420 Byte); den Wortlaut zeigt das Fenster noch nicht.");
    const b = m.bloecke.find((x) => x.id === "portable-contract");
    expect(b && platzVon(b)).toBe("agentmd");
  });
  test("wo ein Teil landet, sagt der Weg der Tür: ein Prompt ist die erste Nachricht und nur jetzt, der Kopf steht über jeder Nachricht", () => {
    const m = modell(antwort([baustein("lesehilfe", { frage: "konzepte", bytes: 100 }), baustein("delivery-header", { frage: "umstaende" })],
      ["lesehilfe ist im Plan aus, diese Tuer liefert es trotzdem (Prompt)", "delivery-header ist im Plan aus, diese Tuer liefert es trotzdem (Zustellung)"]));
    const platz = (id: string) => { const b = m.bloecke.find((x) => x.id === id); return b ? platzVon(b) : null; };
    expect(platz("lesehilfe")).toBe("erste");
    expect(PLATZ.erste.dauer).toBe("jetzt");
    expect(platz("delivery-header")).toBe("jede");
  });
  test("„Nur Ordner“ schaltet einen Baustein nicht: der Grund nennt den Weg zu einer Rolle statt der Regel des Registers", () => {
    const m = modell(antwort([baustein("lane-notes", { frage: "hintergrund" })]));
    expect(m.teile.find((t) => t.id === "lane-notes")?.fest).toBe("Kommt nur mit einer Rolle (Lane, MAIN, Orchestratorin): „Mit anderen Sessions arbeiten“.");
    const anders = modell(antwort([baustein("owner-heft", { frage: "hintergrund", schaltbar: { ja: false, grund: "vom Owner gesperrt." } })]));
    expect(anders.teile.find((t) => t.id === "owner-heft")?.fest).toBe("vom Owner gesperrt.");
  });
  test("ein ausgelassenes Pack sagt den Grund in Menschenworten", () => {
    const m = modell(antwort([baustein("pack:jev-use", { frage: "konzepte" })]));
    expect(m.teile.find((t) => t.id === "pack:jev-use")?.fest).toBe("Die Quelle des Packs liegt nicht in diesem Repo.");
  });
});

describe("Auftrag und Dateien", () => {
  test("bei einem Branch ist das Ziel der Auftrag, mit dem Kopf der Branch-Tür; ohne Branch nimmt die Tür keinen und sagt es", () => {
    const b = modell(antwort([]), ein({ rolle: "branch", auftrag: "Baue den Planer" }));
    expect(b.teile.find((t) => t.id === "auftrag")?.stand).toBe("an");
    expect(b.bloecke.find((x) => x.id === "auftrag")?.text).toMatch(/^\[fleet-zustellung · Ziel eines Branches .*path=branch-goal.*\] Baue den Planer$/);
    const e = modell(antwort([]), ein({ auftrag: "Baue den Planer" }));
    expect(e.teile.find((t) => t.id === "auftrag")?.stand).toBe("aus");
    expect(e.teile.find((t) => t.id === "auftrag")?.fest).toContain("Ohne Branch");
    expect(e.bloecke.find((x) => x.id === "auftrag")?.text).toBe(null);
  });
  test("deine Dateien und die des Ordners stehen getrennt; gelesener Text kommt in den Block", () => {
    const a = antwort([baustein("native-agents", { frage: "hintergrund", zustand: "an", bytes: 300,
      details: { dateien: [{ pfad: "/h/.claude/CLAUDE.md", bytes: 100 }, { pfad: "/r/AGENTS.md", bytes: 200 }], nachgeladen: [] } })]);
    const m = modell(a, ein({ dateien: new Map([["/r/AGENTS.md", "# Regeln des Ordners"]]) }));
    expect(m.teile.find((t) => t.id === "regeln-du")?.herkunft).toBe("du");
    expect(m.teile.find((t) => t.id === "regeln-ordner")?.herkunft).toBe("ordner");
    expect(m.bloecke.find((b) => b.laden === "/r/AGENTS.md")?.text).toBe("# Regeln des Ordners");
    expect(m.bloecke.find((b) => b.laden === "/h/.claude/CLAUDE.md")?.text).toBe(null);
  });
});

// DAS NOTIZBUCH JE SETUP (server/notizbuch.ts): die Zeile „Notizen von Claude“ sagt, ob das Notizbuch eigen, geteilt oder aus ist
describe("das Notizbuch des Setups", () => {
  const zeile = (art: string | null, zustand: "an" | "aus" = "an", bytes = 12, e = ein()) => modell(antwort([baustein("auto-memory", { frage: "hintergrund",
    zustand, bytes, details: { pfad: "/r/MEMORY.md", ...(art ? { notizbuch: { art, pfad: "/r", wem: "x" } } : {}) } })]), e).teile.find((t) => t.id === "auto-memory");
  // die Art ist der Name der Zeile, nicht ein angehängter Zusatz, den eine schmale Spalte abschneidet (UI-Abnahme 22.10.)
  test("die Art des Notizbuchs ist der Name der Zeile, ohne Zusatz", () => {
    expect(zeile("eigen")).toMatchObject({ name: "Eigenes Notizbuch", zusatz: null, stand: "an", fach: "Notizen von Claude (Auto-Memory)" });
    expect(zeile("geteilt")).toMatchObject({ name: "Geteiltes Notizbuch", zusatz: null, stand: "an" });
    expect(zeile("aus", "aus", 0)).toMatchObject({ name: "Kein Notizbuch", zusatz: null, stand: "aus" });
  });
  test("ein leeres Notizbuch ist an, mit 0 Tokens: leer ist der Normalfall, nicht „nicht verfügbar“", () => {
    expect(zeile("geteilt", "aus", 0)).toMatchObject({ name: "Geteiltes Notizbuch", stand: "an", tokens: 0 });
    expect(zeile("eigen", "aus", 0)).toMatchObject({ stand: "an", tokens: 0 });
  });
  test("eine Session an einem Ziel startet auf ihrem Branch mit dessen eigenem, leerem Notizbuch, nicht mit dem geteilten", () => {
    expect(zeile("geteilt", "an", 12, ein({ rolle: "branch" }))).toMatchObject({ name: "Notizbuch des Branches", zusatz: null, stand: "an", tokens: 0 });
  });
  test("ein Server ohne Notizbuch-Angabe zeigt die Zeile wie bisher", () => {
    expect(zeile(null)).toMatchObject({ name: "Notizen von Claude", zusatz: "MEMORY.md" });
  });
});

// Fleets Bibliothek eines Sitzes ohne Rolle (session-blocks.ts#bibliothek, Fachblick 22.10. zu wissen-kommt-an): der Start-Block steht
// unter Hintergrund im Systemprompt, die Skills unter How-to in der Liste der Skills, beide als Fleets Teil mit ihrem Wortlaut
describe("Fleets Bibliothek im Fenster", () => {
  const start = "BIBLIOTHEK (server/sitz-wissen.ts): Fleets Wissen für deinen Sitz.\n\n--- who-it-is-for ---\nText", liste = "- running-fleet: Bevor du landest.";
  const bib = (o: Partial<Baustein> = {}) => [
    baustein("bibliothek", { frage: "hintergrund", zustand: "an", bytes: 99, schaltbar: { ja: false, grund: "Fleet gibt sie jedem Claude-Sitz ohne Rolle mit." },
      details: { text: start, packs: ["working-with-the-owner", "who-it-is-for"] }, ...o }),
    baustein("bibliothek-skills", { frage: "howto", zustand: "an", bytes: 99, schaltbar: { ja: false, grund: "Fleet gibt sie jedem Claude-Sitz ohne Rolle mit." },
      details: { text: liste, packs: ["running-fleet"] }, ...o })];
  test("drin, mit Packs je Weg, Wortlaut am richtigen Ort, und Fleets Summe wächst um ihren Text", () => {
    const ohne = modell(antwort([])), m = modell(antwort(bib()));
    expect(m.teile.find((t) => t.id === "bibliothek")).toMatchObject({ frage: "hintergrund", name: "Fleets Bibliothek", zusatz: "2",
      herkunft: "fleet", stand: "an", schalter: null });
    expect(m.teile.find((t) => t.id === "bibliothek-skills")).toMatchObject({ frage: "howto", zusatz: "1", herkunft: "fleet", stand: "an" });
    expect(m.bloecke.find((b) => b.id === "bibliothek")).toMatchObject({ ort: "system", text: start, leise: false });
    expect(m.bloecke.find((b) => b.id === "bibliothek-skills")).toMatchObject({ ort: "listen", text: liste });
    // der Wortlaut zählt, nicht die Byte-Zahl daneben: 2 Bytes je Token in dieser Antwort
    const utf8 = (t: string) => new TextEncoder().encode(t).length;
    expect(m.summe.fleet - ohne.summe.fleet).toBeCloseTo((utf8(start) + utf8(liste)) / 2, 6);
  });
  test("aus (ein anderer Agent): nicht im Start, kein Wortlaut, nichts gezählt", () => {
    const ohne = modell(antwort([])), m = modell(antwort(bib({ zustand: "aus" })));
    expect(m.teile.find((t) => t.id === "bibliothek")).toMatchObject({ stand: "aus", tokens: 0 });
    expect(m.bloecke.find((b) => b.id === "bibliothek")?.text).toBeNull();
    expect(m.summe.fleet).toBe(ohne.summe.fleet);
  });
});

// den Schalter schaltet der Owner in einem fremden Repo bewusst an: die Zeile sagt in seinen Worten, was er davon hat (Fachblick 22.10.)
describe("Fleets Bibliothek in Owner-Worten", () => {
  test("Unterzeile und Kasten nennen, was er davon hat, und die Teile deutsch, nicht als Pack-Id", () => {
    const m = modell(antwort([baustein("bibliothek", { frage: "hintergrund", zustand: "an", bytes: 9,
      details: { text: "x", packs: ["working-with-the-owner"] } })]));
    const t = m.teile.find((x) => x.id === "bibliothek")!;
    expect(t.unter).toBe("wie du sprichst");
    expect(t.mehr.slice(0, 2)).toEqual([["Was er davon hat", "Er weiß von Anfang an, wie du arbeitest."],
      ["Die Teile", "Mit dem Owner arbeiten"]]);
  });
  // die Box seit runde4 (Owner 22.10.): für wen und mit dem Owner; sie kommt in jedes Repo, Fleets eigene Arbeit nur ins Fleet-Repo
  test("die Box mit „Für wen“: Unterzeile und Satz nennen es, der Kasten sagt, wo sie hinkommt", () => {
    const m = modell(antwort([baustein("bibliothek", { frage: "hintergrund", zustand: "an", bytes: 9,
      details: { text: "x", packs: ["who-it-is-for", "working-with-the-owner"] } })]));
    const t = m.teile.find((x) => x.id === "bibliothek")!;
    expect(t.unter).toBe("für wen er baut, wie du sprichst");
    expect(t.mehr).toEqual([["Was er davon hat", "Er weiß von Anfang an, für wen er baut und wie du arbeitest."],
      ["Die Teile", "Für wen · Mit dem Owner arbeiten"],
      ["Wo", "In jedem Repo. Fleets eigene Arbeit (Landen, Deploy, Testinstanz, Agenten aufsetzen, Systemkonzept) nur im Fleet-Repo."]]);
  });
  test("eine andere Zeile bekommt keine Unterzeile", () => {
    expect(modell(antwort([baustein("lane-notes", { frage: "hintergrund", zustand: "an" })])).teile.find((x) => x.id === "lane-notes"))
      .toMatchObject({ unter: null, mehr: [] });
  });
});

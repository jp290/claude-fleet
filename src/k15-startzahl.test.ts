// K15 · die Zahl eines Starts (src/k15-startzahl.ts; Bauleitung f6edd1e7, Punkt 1: „Zahl oben aus der Aufschlüsselung + Datei-Ort,
// CLAUDE_CODE_MESSUNG nur als Rückfall ohne Quelle“)
import { describe, expect, test } from "bun:test";
import type { Answer, Baustein } from "./founding";
import { startZahl, verteile } from "./k15-startzahl";

const baustein = (id: string, o: Partial<Baustein> = {}): Baustein => ({ id, wort: id, satz: "", funktion: ["vertrag"], grenze: { art: "frei" },
  schicht: "", zustand: "an", quelle: "default", rollenDefault: "an", harness: { gueltig: true, grund: null }, schaltbar: { ja: true }, bytes: "unknown",
  ersatzKandidaten: [], ...o });
const QUELLE = { slot: 3, rolle: "lane", ort: "claude-fleet", claude: "2.1.301", modell: null, seit: 1, tokens: 30000, bytesJeToken: 2.5 };
const teil = (name: string, bytes: number | null, stand = "an") => ({ name, bytes, stand, weg: "mitgeliefert", satz: "s" });
const anatomie = (quelle: typeof QUELLE | null) => ({ quelle, grund: quelle ? null : "noch keine Session gemessen", gruppen: [
  { id: "systemprompt", wort: "Systemprompt", satz: "s", teile: [teil("Regeln", 10000), teil("Umgebung", 2500)] },
  { id: "werkzeuge", wort: "Werkzeuge", satz: "s", teile: [teil("Read", 5000), teil("Bash", null), teil("Agent", 9999, "aus")] },
  { id: "plugins", wort: "Plugins", satz: "s", teile: [teil("figma", 5000)] },
] });
type Datei = { pfad: string; bytes: number };
function plan(o: { anatomie?: unknown; messung?: { tokens: number; gilt: boolean }; nativ?: number | "unknown" | null; fleetBytes?: number; regeln?: number;
  nativDateien?: Datei[]; regelnDateien?: Datei[] }): Answer {
  const bs = [baustein("lane-footer", { bytes: 2000 }), ...(o.nativ !== undefined && o.nativ !== null ? [baustein("native-agents", { bytes: o.nativ,
    ...(o.nativDateien ? { details: { dateien: o.nativDateien, nachgeladen: [], regel: "r" } } : {}) })] : [])];
  return { selected: [], omitted: [], sessionAgents: { text: "", bytes: 0, parts: [] },
    plan: { planHash: "h", planSatz: "", rolle: "lane", harness: "claude", modell: null, effort: null, ort: { art: "repo", pfad: "/r", branch: "main", head: "x" },
      bytesVorAuftrag: { bytes: 0, unknown: [], auftrag: [] }, bausteine: bs },
    rollen: [], start: { tuer: "lane", startbar: true, refusals: [] },
    lieferung: { tuer: "lane", geliefert: bs.map((b) => ({ id: b.id, weg: b.id === "native-agents" ? "native Datei" : "Session-Datei" })), ausgelassen: [] },
    claudeCode: { rolle: "lane", zeilen: [{ id: "globale-regeln", wort: "Globale Regeln", satz: "", quelle: "q", weg: "native Datei", bytes: o.regeln ?? 0, wert: "1 Datei",
        ...(o.regelnDateien ? { details: { dateien: o.regelnDateien, nachgeladen: [] } } : {}) },
      { id: "systemprompt", wort: "Systemprompt", satz: "", quelle: "q", weg: "Claude Code", bytes: "unknown", wert: "eingebaut" }],
      messung: { rolle: "lane", tokens: o.messung?.tokens ?? 40000, am: "", claude: "", modell: "", quelle: "q", gilt: o.messung?.gilt ?? true },
      ...(o.anatomie !== undefined ? { anatomie: o.anatomie } : {}) } as Answer["claudeCode"],
    startSumme: { fleetBytes: o.fleetBytes ?? 2000, fleetUnbekannt: [], fleetTokens: 0, bytesJeToken: { wert: 2, quelle: "q" }, claudeCodeTokens: 40000, tokens: 0 } };
}

describe("Claude Codes Teil", () => {
  test("aus der Aufschlüsselung zum Verhältnis der Quelle, dazu die globalen Regeln zu Fleets Verhältnis; Plugins und Abgeschaltetes zählen nicht", () => {
    // (10000 + 2500 + 5000) / 2,5 = 7000; 600 / 2 = 300
    expect(startZahl(plan({ anatomie: anatomie(QUELLE), regeln: 600 }))?.claudeCode).toEqual({ tokens: 7300, wie: "aufgeschlüsselt" });
  });
  test("ohne gemessene Quelle die feste Messung des Servers, als „gemessen“", () => {
    expect(startZahl(plan({ anatomie: anatomie(null), regeln: 600 }))?.claudeCode).toEqual({ tokens: 40000, wie: "gemessen" });
    expect(startZahl(plan({ regeln: 600 }))?.claudeCode).toEqual({ tokens: 40000, wie: "gemessen" });
  });
  test("ohne Quelle und ohne gültige Messung keine Zahl für Claude Code; die Summe sagt dann nur Fleets Teil", () => {
    const z = startZahl(plan({ messung: { tokens: 40000, gilt: false } }));
    expect(z?.claudeCode).toBe(null);
    expect(z?.tokens).toBe(1000);
  });
});

describe("die Summe und die Dateien des Repos", () => {
  test("ohne Rolle gemessen: die Dateien des Repos stehen für sich, nicht in Fleets Teil", () => {
    const z = startZahl(plan({ anatomie: anatomie(QUELLE), nativ: 8000, fleetBytes: 10000 }));
    expect(z).toEqual({ tokens: 7000 + 1000 + 4000, claudeCode: { tokens: 7000, wie: "aufgeschlüsselt" }, fleet: 1000, repo: 4000 });
  });
  test("die globalen Regeln zählen einmal: Claude Codes Teil hat sie, bei den Dateien des Repos stehen sie nicht noch einmal", () => {
    // ohne Rolle misst der Server die Dateien des Ordners wie Claude Code sie lädt, die Config-CLAUDE.md zuerst (server.ts#nativeLoaderBytes)
    const regeln = { pfad: "/h/.claude/CLAUDE.md", bytes: 600 };
    const z = startZahl(plan({ anatomie: anatomie(QUELLE), regeln: 600, regelnDateien: [regeln], nativ: 8600,
      nativDateien: [regeln, { pfad: "/r/CLAUDE.md", bytes: 8000 }], fleetBytes: 10600 }));
    expect(z).toEqual({ tokens: 7300 + 1000 + 4000, claudeCode: { tokens: 7300, wie: "aufgeschlüsselt" }, fleet: 1000, repo: 4000 });
  });
  test("eine Datei der globalen Regeln, die der Server bei den Dateien des Repos nicht nennt, zieht dort nichts ab", () => {
    const z = startZahl(plan({ anatomie: anatomie(QUELLE), regeln: 600, regelnDateien: [{ pfad: "/h/.claude/CLAUDE.md", bytes: 600 }], nativ: 8000,
      nativDateien: [{ pfad: "/r/CLAUDE.md", bytes: 8000 }], fleetBytes: 10000 }));
    expect(z?.repo).toBe(4000);
  });
  test("mit Rolle geliefert, aber nicht gemessen: null, die Summe zählt sie nicht", () => {
    const z = startZahl(plan({ anatomie: anatomie(QUELLE), nativ: "unknown" }));
    expect([z?.repo, z?.tokens]).toEqual([null, 8000]);
  });
  test("keine Dateien des Repos im Plan: 0", () => {
    expect(startZahl(plan({ anatomie: anatomie(QUELLE) }))?.repo).toBe(0);
  });
  test("ohne Start-Summe (älterer Server) keine Zahl", () => {
    expect(startZahl({ ...plan({}), startSumme: undefined })).toBe(null);
  });
});

// Runde 4, Punkt 0: die Gruppen nach dem Klick auf die Summe ergeben die Summe. Fleets Teil wird nach Bytes auf die Wege verteilt;
// einzeln gerundet ergäben drei Wege mit je 1,5 Tokens 6 statt der 5 (4,5 gerundet), die oben stehen
describe("verteile: Fleets Tokens auf die Wege, die Teile ergeben die Summe", () => {
  test("drei gleiche Wege mit halben Tokens: zusammen genau die Summe, nicht jeder einzeln aufgerundet", () => {
    expect(verteile(5, [3, 3, 3])).toEqual([2, 2, 1]);
  });
  test("der Rest geht an den Weg mit dem größten Nachkomma-Anteil, nicht an den ersten", () => {
    expect(verteile(10, [1, 8.4, 0.6].map((x) => x * 2.1))).toEqual([1, 8, 1]);
  });
  test("ein Weg ohne Bytes bekommt nichts, ein einzelner Weg alles", () => {
    expect(verteile(227, [0, 476])).toEqual([0, 227]);
  });
  test("ohne Bytes und ohne Wege: nichts zu verteilen", () => {
    expect(verteile(0, [0, 0])).toEqual([0, 0]);
    expect(verteile(0, [])).toEqual([]);
  });
  test("jeder Teil ist sein genauer Anteil ab- oder aufgerundet, die Summe stimmt", () => {
    const anteile = [5729, 20664, 13300, 1, 4892];
    const teile = verteile(21170, anteile);
    const summe = anteile.reduce((n, x) => n + x, 0);
    expect(teile.reduce((n, x) => n + x, 0)).toBe(21170);
    teile.forEach((t, i) => expect(Math.abs(t - (anteile[i]! / summe) * 21170)).toBeLessThan(1));
  });
});

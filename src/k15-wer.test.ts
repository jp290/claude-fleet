// K15 · wer bestimmt (src/k15-wer.ts; Owner 16.10. 09:1x: „[Zitat entfernt]“
// ): je Baustein aus dem Plan, je Zeile von Claude Code; jedes „[Zitat entfernt]“ mit Grund
import { describe, expect, test } from "bun:test";
import type { Baustein } from "./founding";
import { DU, istSchalter, nativVon, werBeiClaudeCode, werBeiTeil, werBestimmt, werDesAbschnitts, werTitel, type Wer, type WerPlan } from "./k15-wer";

const bst = (id: string, x: Partial<Baustein> = {}): Baustein => ({ id, wort: id, satz: "", funktion: ["orientierung"], grenze: { art: "frei" }, schicht: "",
  zustand: "an", quelle: "default", rollenDefault: "an", harness: { gueltig: true, grund: null }, schaltbar: { ja: true }, bytes: 10, ersatzKandidaten: [], ...x });
const plan = (x: Partial<WerPlan> = {}): WerPlan => ({ traeger: new Map(), nativ: new Set(["native-agents", "auto-memory"]), ohneQuelle: new Map(), fehlt: new Map(), name: (b) => `Name ${b.id}`, ...x });

describe("werBestimmt", () => {
  test("an im Plan, aber dieser Start liefert es nicht: Fleet legt fest, mit dem Grund der Lieferung, auch vor Pflicht und Schalter", () => {
    const fehlt = new Map([["task-brief", "the door of an open start delivers no card"], ["lane-notes", "x"]]);
    const herleitung = "on in the plan, but the door of this start does not deliver it (founding plan, lieferung.ausgelassen)";
    expect(werBestimmt(bst("task-brief", { grenze: { art: "noetig", grund: "Ohne Auftrag weiß die Session nicht, was zu tun ist." } }), plan({ fehlt })))
      .toEqual({ art: "fleet", grund: "This start does not deliver it: the door of an open start delivers no card.", herleitung });
    expect(werBestimmt(bst("lane-notes"), plan({ fehlt }))).toEqual({ art: "fleet", grund: "This start does not deliver it: x.", herleitung });
    // aus liefert ohnehin nichts: dann gilt, was sonst gilt
    expect(werBestimmt(bst("lane-notes", { zustand: "aus" }), plan({ fehlt }))).toEqual(DU);
  });
  test("ein freier, schaltbarer Baustein ist änderbar, an wie aus", () => {
    expect(werBestimmt(bst("lane-notes"), plan())).toEqual(DU);
    expect(werBestimmt(bst("source-code", { zustand: "aus" }), plan())).toEqual(DU);
  });
  test("eine Pflicht, die an ist, legt Fleet fest, mit dem Grund aus dem Plan; ein Ersatz derselben Funktion steht in der Herleitung", () => {
    const w = werBestimmt(bst("task-brief", { grenze: { art: "noetig", grund: "Ohne Auftrag weiß die Session nicht, was zu tun ist." }, ersatzKandidaten: ["main-rail"] }), plan());
    expect(w).toEqual({ art: "fleet", grund: "Ohne Auftrag weiß die Session nicht, was zu tun ist.",
      herleitung: "required for this role (session-blocks.ts, grenze); replaceable only by a block with the same function: main-rail" });
  });
  test("gesperrt: auch kein gleichwertiger Ersatz", () => {
    const w = werBestimmt(bst("portable-contract", { grenze: { art: "noetig", grund: "Owner-Entscheid: nötig und gesperrt.", gesperrt: true } }), plan());
    expect(w).toEqual({ art: "fleet", grund: "Owner-Entscheid: nötig und gesperrt.", herleitung: "required and locked: not even an equivalent function replaces it (session-blocks.ts, grenze)" });
  });
  test("eine Pflicht, die bei dieser Rolle aus ist, lässt sich dazuschalten: änderbar", () => {
    expect(werBestimmt(bst("main-rail", { zustand: "aus", grenze: { art: "noetig", grund: "x" } }), plan())).toEqual(DU);
  });
  test("was eine Pflicht trägt, legt Fleet fest und nennt die Pflicht beim Namen", () => {
    const vertrag = bst("portable-contract", { grenze: { art: "noetig", grund: "g", gesperrt: true } });
    expect(werBestimmt(bst("pack:portable-core"), plan({ traeger: new Map([["pack:portable-core", vertrag]]) }))).toEqual({ art: "fleet",
      grund: "It is part of “Name portable-contract”, which is required; without it, that would not arrive at this start.", herleitung: "portable-contract is part of it through enthaltenIn (founding plan)" });
    // aus trägt es nichts
    expect(werBestimmt(bst("pack:portable-core", { zustand: "aus" }), plan({ traeger: new Map([["pack:portable-core", vertrag]]) }))).toEqual(DU);
  });
  test("gilt nicht für diesen Agenten: Fleet legt fest, mit dem Grund des Registers", () => {
    expect(werBestimmt(bst("private-rulebook", { zustand: "aus", harness: { gueltig: false, grund: "CLAUDE.md liest nur Claude Code." } }), plan()))
      .toEqual({ art: "fleet", grund: "CLAUDE.md liest nur Claude Code.", herleitung: "applies to certain agents only (session-blocks.ts, harness)" });
  });
  test("was Claude Code selbst lädt und an ist, legt Claude Code fest; ist es aus, hat Fleet es beim Start abgeschaltet", () => {
    const grund = "Claude lädt seine Notizen selbst; Fleet schaltet sie nur beim Start einer Lane ab.";
    expect(werBestimmt(bst("native-agents", { schaltbar: { ja: false, grund: "Der Agent lädt den Ordner selbst." } }), plan()))
      .toEqual({ art: "claude-code", grund: "Der Agent lädt den Ordner selbst.", herleitung: "Claude Code loads it itself; Fleet has no switch for it (session-blocks.ts, nichtSchaltbar)" });
    expect(werBestimmt(bst("auto-memory", { zustand: "aus", schaltbar: { ja: false, grund } }), plan()))
      .toEqual({ art: "fleet", grund, herleitung: "Fleet switches it off when this role starts (session-blocks.ts, nichtSchaltbar)" });
  });
  test("bei „Nur Ordner“ ist alles andere nicht schaltbar: das legt Fleet fest", () => {
    expect(werBestimmt(bst("role-card", { zustand: "aus", schaltbar: { ja: false, grund: "Nur Ordner liefert nur native-agents und auto-memory." } }), plan()))
      .toEqual({ art: "fleet", grund: "Nur Ordner liefert nur native-agents und auto-memory.", herleitung: "the plan for this role does not let it be switched (founding plan, schaltbar)" });
  });
  test("ohne den Plan von „Nur Ordner“ ist ein nicht schaltbarer Baustein noch nicht zuzuordnen: kein Kennzeichen statt eines geratenen", () => {
    expect(werBestimmt(bst("native-agents", { schaltbar: { ja: false, grund: "x" } }), plan({ nativ: null }))).toBeNull();
    expect(werBestimmt(bst("lane-notes"), plan({ nativ: null }))).toEqual(DU);
  });
  test("ein Pack ohne Quelle und eine unerfüllte Bedingung lehnt der Plan ab: fest, mit Grund", () => {
    expect(werBestimmt(bst("pack:verify-e2e", { zustand: "aus" }), plan({ ohneQuelle: new Map([["pack:verify-e2e", "die Quelldatei fehlt im Repo"]]) })))
      .toEqual({ art: "fleet", grund: "The pack has no source: die Quelldatei fehlt im Repo.", herleitung: "the plan does not accept a pack without a source (founding plan, omitted)" });
    expect(werBestimmt(bst("private-rulebook", { zustand: "aus", bedingung: { grund: "Claude mit dem Regelbuch-Auszug seiner Rolle", erfuellt: false } }), plan()))
      .toEqual({ art: "fleet", grund: "Only if: Claude mit dem Regelbuch-Auszug seiner Rolle; that does not hold here.", herleitung: "the plan rejects an unmet condition (session-blocks.ts, rollenDefault bedingt)" });
  });
  test("eine Bedingung, die erst beim Start bekannt ist, oder eine erfüllte, bleibt änderbar", () => {
    expect(werBestimmt(bst("lane-notes", { zustand: "aus", bedingung: { grund: "Notizen", erfuellt: "unknown" } }), plan())).toEqual(DU);
    expect(werBestimmt(bst("lane-notes", { zustand: "aus", bedingung: { grund: "Notizen", erfuellt: true } }), plan())).toEqual(DU);
  });
});

describe("nativVon: was eine Session „Nur Ordner“ bekommen kann, lädt Claude Code selbst", () => {
  test("an und bedingt zählen, aus nicht", () => {
    expect([...nativVon([bst("native-agents"), bst("auto-memory", { rollenDefault: { zustand: "bedingt", grund: "Notizen" } }), bst("role-card", { rollenDefault: "aus" })])])
      .toEqual(["native-agents", "auto-memory"]);
    expect([...nativVon([])]).toEqual([]);
  });
});

describe("werBeiClaudeCode: der Systemprompt ist ein Claude-Code-Standard, ein Schalter der Startzeile ein Fleet-Standard; der Grund sagt, ob es einstellbar ist", () => {
  const z = (weg: string) => ({ weg, satz: "Satz", quelle: "server.ts#agentCmd" });
  test("ein Schalter, auch sein Fehlen, ist Fleets Startzeile", () => {
    expect(werBeiClaudeCode(z("--tools"))).toEqual({ art: "fleet", grund: "Not settable per session yet, Fleet sets it at start: Satz", herleitung: "Fleet’s start line: --tools (server.ts#agentCmd); settable per session only with a start line of its own" });
    expect(werBeiClaudeCode(z("kein --tools")).art).toBe("fleet");
    expect(werBeiClaudeCode(z("--settings · --disallowedTools")).art).toBe("fleet");
  });
  test("was Claude Code selbst schreibt oder aus seiner Konfiguration lädt, ist ein Claude-Code-Standard und nicht in Fleet einstellbar", () => {
    expect(werBeiClaudeCode(z("Claude Code"))).toEqual({ art: "claude-code", grund: "Not settable in Fleet: Satz", herleitung: "Claude Code (server.ts#agentCmd)" });
    expect(werBeiClaudeCode(z("native Datei")).art).toBe("claude-code");
    expect(werBeiClaudeCode(z("Konfiguration des Accounts")).art).toBe("claude-code");
  });
  test("ein Gedankenstrich oder ein Wort mit Bindestrich ist kein Schalter", () => {
    expect(istSchalter("Session-Datei")).toBe(false);
    expect(istSchalter("a -- b")).toBe(false);
    expect(istSchalter("--Tools")).toBe(false);
  });
});

describe("werBeiTeil", () => {
  test("ein Schalter der Startzeile ist ein Fleet-Standard, ein Ort ein Claude-Code-Standard; der Grund sagt, ob es einstellbar ist, dann den Satz des Teils", () => {
    expect(werBeiTeil({ weg: "--settings skillOverrides", satz: "Fleet nimmt es aus der Liste." })).toEqual({ art: "fleet", grund: "Not settable per session yet, Fleet sets it at start: Fleet nimmt es aus der Liste.",
      herleitung: "Fleet’s start line: --settings skillOverrides; settable per session only with a start line of its own" });
    expect(werBeiTeil({ weg: "Plugin figma", satz: "kommt mit dem Plugin figma" })).toEqual({ art: "claude-code", grund: "Not settable in Fleet: kommt mit dem Plugin figma",
      herleitung: "Plugin figma: Claude Code loads it itself" });
  });
  test("ein Wort mit Bindestrich ist kein Schalter", () => {
    expect(werBeiTeil({ weg: "claude.ai-Anbindung", satz: "s" }).art).toBe("claude-code");
    expect(werBeiTeil({ weg: "mitgeliefert", satz: "s" }).art).toBe("claude-code");
  });
});

// Runde 4, Owner Z60 „[Zitat entfernt]“: ein Kennzeichen je Abschnitt, an der Zeile nur, wo sie abweicht
describe("werDesAbschnitts", () => {
  const F: Wer = { art: "fleet", grund: "g", herleitung: "h" }, C: Wer = { art: "claude-code", grund: "c", herleitung: "h" };
  test("die Art der meisten Zeilen steht einmal im Kopf; ihr Grund zählt die Zeilen", () => {
    expect(werDesAbschnitts([F, F, DU, F, C])).toEqual({ art: "fleet", grund: "3 of 5 rows in this section; a row that differs carries its own tag.",
      herleitung: "the reason for each row is in its title" });
    expect(werDesAbschnitts([DU, F, DU, DU, F])).toEqual(DU);
  });
  test("bei Gleichstand gilt die zuerst genannte Art", () => {
    expect(werDesAbschnitts([C, F, F, C])?.art).toBe("claude-code");
    expect(werDesAbschnitts([F, C])?.art).toBe("fleet");
  });
  test("ohne Zeile, die etwas sagt, steht im Kopf nichts", () => {
    expect(werDesAbschnitts([])).toBeNull();
    expect(werDesAbschnitts([null, null])).toBeNull();
    expect(werDesAbschnitts([null, C, null])?.art).toBe("claude-code");
  });
  test("was an der Zeile wegfällt, steht in ihrem Title", () => {
    expect(werTitel(F)).toBe("Fleet default: g");
    expect(werTitel(DU)).toBe("settable: you set it here");
  });
});

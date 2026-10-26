// Welches Modell wirklich antwortete (src/modell-verlauf.ts): ein Transkript in der Form, die Claude Code 2.1.309 schrieb, als es den Beweiser in
// Schritt 5, Lauf 2 von Opus 5.5 auf Opus 4.8 umstellte (Zeile system/model_refusal_fallback, danach Antworten von claude-opus-4-8).
import { describe, expect, test } from "bun:test";
import { laufBerichtAus } from "./lauf-bericht";
import { modellAbschnittAus, modellVerlauf } from "./modell-verlauf";

const antwort = (model: string, at: string, requestId: string, sidechain = false) =>
  JSON.stringify({ type: "assistant", isSidechain: sidechain, timestamp: at, requestId, message: { model, id: `msg_${requestId}`, content: [{ type: "text", text: "…" }] } });
const umstellung = (at: string) => JSON.stringify({ type: "system", subtype: "model_refusal_fallback", isSidechain: false, timestamp: at, level: "warning",
  originalModel: "claude-opus-5-5[1m]", fallbackModel: "claude-opus-4-8", apiRefusalCategory: "cyber", content: "Opus 5.5 (1M context)'s safeguards flagged this session." });
export const TRANSKRIPT_MIT_WECHSEL = [
  JSON.stringify({ type: "user", timestamp: "2026-10-23T02:03:50.000Z", message: { role: "user", content: "Brief" } }),
  // ein Aufruf schreibt je Inhaltsblock eine Zeile mit derselben requestId
  antwort("claude-opus-5-5", "2026-10-23T02:03:54.938Z", "req_1"), antwort("claude-opus-5-5", "2026-10-23T02:03:55.100Z", "req_1"),
  antwort("claude-opus-5-5", "2026-10-23T02:10:00.000Z", "req_2"),
  // ein Subagent mit einem anderen Modell ist nicht der Sitz, und <synthetic> ist keine Antwort eines Modells
  antwort("claude-sonnet-5-5", "2026-10-23T02:11:00.000Z", "req_s", true),
  antwort("<synthetic>", "2026-10-23T02:12:00.000Z", "req_x"),
  "{kaputte Zeile",
  umstellung("2026-10-23T02:14:42.416Z"),
  antwort("claude-opus-4-8", "2026-10-23T02:15:05.336Z", "req_3"), antwort("claude-opus-4-8", "2026-10-23T02:15:06.957Z", "req_3"),
  antwort("claude-opus-4-8", "2026-10-23T02:20:00.000Z", "req_4"), antwort("claude-opus-4-8", "2026-10-23T02:25:00.000Z", "req_5"),
].join("\n");

describe("welches Modell wirklich antwortete", () => {
  test("ein Wechsel nach einer Meldung der Sicherung: zwei Abschnitte, der zweite ab der Meldung, mit Grund und seinen Aufrufen", () => {
    expect(modellVerlauf(TRANSKRIPT_MIT_WECHSEL)).toEqual([
      { modell: "claude-opus-5-5", ab: "2026-10-23T02:03:54.938Z", aufrufe: 2, grund: null },
      { modell: "claude-opus-4-8", ab: "2026-10-23T02:14:42.416Z", aufrufe: 3,
        grund: "Claude Code switched from claude-opus-5-5[1m] to claude-opus-4-8 after a safety flag (“cyber”) (model_refusal_fallback)" },
    ]);
  });
  test("ohne Wechsel ein Abschnitt; ein Wechsel ohne Meldung (etwa /model) steht ab seiner ersten Antwort, ohne Grund", () => {
    const ohne = [antwort("claude-sonnet-5-5", "2026-10-23T01:00:00.000Z", "a"), antwort("claude-sonnet-5-5", "2026-10-23T01:01:00.000Z", "b")].join("\n");
    expect(modellVerlauf(ohne)).toEqual([{ modell: "claude-sonnet-5-5", ab: "2026-10-23T01:00:00.000Z", aufrufe: 2, grund: null }]);
    const hand = `${ohne}\n${antwort("claude-haiku-5-5", "2026-10-23T01:05:00.000Z", "c")}`;
    expect(modellVerlauf(hand).at(-1)).toEqual({ modell: "claude-haiku-5-5", ab: "2026-10-23T01:05:00.000Z", aufrufe: 1, grund: null });
  });
  test("ein leeres oder kaputtes Transkript hat keinen Abschnitt", () => {
    expect([modellVerlauf(""), modellVerlauf("{x\nnull\n[]")]).toEqual([[], []]);
  });
  test("ein Lauf-Bericht trägt die Abschnitte je Sitz; ein schiefer Abschnitt lehnt den Lauf ab, ein Lauf ohne sie bleibt gültig", () => {
    const lauf = (modelle: unknown) => ({ fassung: "a".repeat(64), quelle: "q", start: "2026-10-23T02:00:00Z", ende: "2026-10-23T03:00:00Z", nachrichten: [], befunde: [],
      ohneBefund: [], kosten: "k", grenzen: [], sitze: [{ pos: "beweiser", wie: "eine Session", ablehnungen: [], zahlen: {}, ...(modelle === undefined ? {} : { modelle }) }] });
    const verlauf = modellVerlauf(TRANSKRIPT_MIT_WECHSEL);
    const mit = laufBerichtAus(lauf(verlauf), ["beweiser"]);
    expect(typeof mit === "string" ? mit : mit.sitze[0]?.modelle).toEqual(verlauf);
    const ohne = laufBerichtAus(lauf(undefined), ["beweiser"]);
    expect(typeof ohne === "string" ? ohne : "modelle" in ohne.sitze[0]!).toBe(false);
    expect(laufBerichtAus(lauf([{ modell: "claude-opus-4-8", ab: "gestern", aufrufe: 3, grund: null }]), ["beweiser"])).toBe("has no valid sitze");
    expect(modellAbschnittAus({ modell: "m", ab: "2026-10-23T02:00:00Z", aufrufe: -1, grund: null })).toBeNull();
    expect(modellAbschnittAus({ modell: "m", ab: "2026-10-23T02:00:00Z", aufrufe: 1, grund: "" })).toBeNull();
  });
});

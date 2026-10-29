// src/safety-note.ts: eine gestoppte Antwort wird benannt (Brief 2026-10-29, Ziel 3). Claude Code
// schreibt selbst, wenn die Sicherungen eines Modells eine Antwort gestoppt oder das Modell nach
// einer Flagge gewechselt haben (gemessen 2026-10-29, system/informational und
// system/model_refusal_fallback). Diese Blatt hält die gemessenen Formen und die Worte der einen
// stillen Zeile — server.ts#viewEntry und src/client.ts#addStopLine erkennen mit derselben Funktion.
import { describe, expect, test } from "bun:test";
import { SAFETY_ADVICE, SAFETY_CLASSIFIER_LEAD, safetyClassifierOwn, safetySystemNote } from "./safety-note";

describe("safety-note: was Claude Code über gestoppte Antworten schreibt", () => {
  const stopped = { type: "system", subtype: "informational", level: "notice",
    content: "Opus 5.5's safeguards stopped the response above · continuing once with that noted", timestamp: "2026-01-01T12:00:01.000Z" };
  const fallback = { type: "system", subtype: "model_refusal_fallback", level: "warning", originalModel: "Opus 5.5", fallbackModel: "Opus 4.8",
    content: "Opus 5.5's safeguards flagged this session. Opus 4.8 is answering instead, or you can edit and retry with Opus 5.5 if you prefer.\n\nDetails: `[cyber]`", timestamp: "2026-01-01T12:00:02.000Z" };

  test("die gestoppte Antwort: die Zeile nennt Modell und Geschehen in klaren Worten", () => {
    expect(safetySystemNote(stopped)).toEqual({
      summary: "Opus 5.5's safeguards stopped the answer — trying once more",
      advice: SAFETY_ADVICE,
      raw: stopped.content,
    });
  });

  test("der Modellwechsel nach der Flagge: Ursprung und Ersatz stehen in der Zeile", () => {
    expect(safetySystemNote(fallback)).toEqual({
      summary: "Opus 5.5's safeguards flagged this session — Opus 4.8 is answering instead",
      advice: SAFETY_ADVICE,
      raw: fallback.content,
    });
    // ohne die strukturierten Felder liest die Zeile die Namen selbst aus ihrem Text
    const bare = safetySystemNote({ content: fallback.content });
    expect(bare?.summary).toBe("Opus 5.5's safeguards flagged this session — Opus 4.8 is answering instead");
  });

  test("was der Owner tun kann, steht in einem Satz: umschreiben, anderes Modell, Text zurückholen", () => {
    expect(SAFETY_ADVICE)
      .toBe("Rephrase and send again, give this text to a session on another model, or take it back into the composer (Esc).");
  });

  test("jede andere system-Zeile ist keine Notiz, und die eigene Zeile an das Modell bleibt erkennbar", () => {
    expect(safetySystemNote({ subtype: "compact_boundary", content: "Conversation compacted" })).toBeNull();
    expect(safetySystemNote({ content: "Ein Zitat: Opus 5.5's safeguards stopped the response" })).toBeNull();
    expect(safetySystemNote({ content: "" })).toBeNull();
    expect(safetyClassifierOwn(`${SAFETY_CLASSIFIER_LEAD} (flagged as [cyber]). …`)).toBe(true);
    expect(safetyClassifierOwn("Your response above was fine")).toBe(false);
  });
});

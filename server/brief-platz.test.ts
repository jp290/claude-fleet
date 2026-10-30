// Owner 30.10.: die Absicht der Vorgängerin kommt ganz an. Über dem Owner-Knopf (und der Schwellen-Nachfolge) kommen Brief, Absicht und
// Transkript-Rest zusammen; über 32 KiB kam nur eine Zeiger-Zeile an. Der Rest weicht, nie die Absicht.
import { describe, expect, test } from "bun:test";
import { briefRoom, freshSuccessionAppendix, FRESH_TAIL_MAX, tailThatFits, type FreshTail } from "./brief-platz";
import { lineageIntentFits, LINEAGE_INTENT_MAX, LINEAGE_INTENT_MAX_BYTES, standingHandoverFrom } from "./types";

const PASTE_MAX_BYTES = 32 * 1024;
const bytes = (s: string): number => Buffer.byteLength(s, "utf8");
const standing = (intent: string) => ({ at: 1_000, openedAt: 7, intent, pointer: null, ahead: null });
// the transcript rest as freshTranscriptTail makes it: 16 entries of 1 500 characters, ä-heavy, under FRESH_TAIL_MAX
const tailOf = (): FreshTail => {
  const parts = Array.from({ length: 16 }, (_, i) => `=== ${i % 2 ? "ANTWORT" : "EINGANG"} 2026-10-30T10:${String(i).padStart(2, "0")}\n${`Zeile ${i} ä ü ö. `.repeat(90)}`.slice(0, 1_500));
  const text = parts.join("\n");
  return { state: "read", reason: null, source: "x.jsonl", entries: parts.length, omitted: 0, chars: text.length, text, parts };
};
const RITUAL_FILLER = "Du bist die Nachfolgerin. ".repeat(110);   // ~3 KB: the brief without the intent

describe("der Brief einer Nachfolge über den Owner-Knopf bleibt unter der Paste-Grenze", () => {
  test("Maßstab: 10 000 Zeichen Absicht plus ein voller Rest (24 000) sind ohne Platzangabe über 32 KiB (das war der Zeiger-Fall)", () => {
    const intent = "ä".repeat(10_000);
    const ritual = `${RITUAL_FILLER}\n${intent}`;
    const tail = tailOf();
    expect(tail.chars).toBeLessThanOrEqual(FRESH_TAIL_MAX);
    const whole = `${ritual}\n\n${freshSuccessionAppendix(standing(intent), tail, 5_000, "generic")}`;
    expect(bytes(whole)).toBeGreaterThan(PASTE_MAX_BYTES);
  });

  test("generischer Weg: mit der Platzangabe kommt die Absicht ganz und der Rest wird auf das Jüngste gekürzt", () => {
    const intent = "ä".repeat(10_000);
    const ritual = `${RITUAL_FILLER}\n${intent}`;
    const appendix = freshSuccessionAppendix(standing(intent), tailOf(), 5_000, "generic", null, "owner", briefRoom(PASTE_MAX_BYTES, ritual));
    const brief = `${ritual}\n\n${appendix}`;
    expect(bytes(brief)).toBeLessThanOrEqual(PASTE_MAX_BYTES - 1024);
    expect(brief.includes(intent)).toBe(true);
    expect(appendix).toContain("und der Platz im Brief");
    expect(appendix).toContain("Zeile 15 ä");        // the newest entry survives
    expect(appendix).not.toContain("Zeile 0 ä");      // the oldest gives way
  });

  test("Program-Weg: die Absicht steht im Anhang selbst und bleibt ganz, auch mit Mehrbyte-Zeichen an der Byte-Grenze", () => {
    const intent = "ä".repeat(LINEAGE_INTENT_MAX_BYTES / 2);
    expect(lineageIntentFits(intent)).toBe(true);
    const ritual = RITUAL_FILLER;
    const appendix = freshSuccessionAppendix(standing(intent), tailOf(), 5_000, "program", "Zusammenfassung des Workers.", "threshold",
      briefRoom(PASTE_MAX_BYTES, ritual));
    const brief = `${ritual}\n\n${appendix}`;
    expect(bytes(brief)).toBeLessThanOrEqual(PASTE_MAX_BYTES - 1024);
    expect(brief.includes(intent)).toBe(true);
    expect(brief).toContain("Zusammenfassung des Workers.");
  });

  test("ist selbst die Absicht fast der ganze Platz, entfällt der Rest ganz und nennt es, die Absicht bleibt", () => {
    const intent = "ä".repeat(10_000);
    const appendix = freshSuccessionAppendix(standing(intent), tailOf(), 5_000, "program", null, "owner", intent.length * 2 + 1_200);
    expect(appendix.includes(intent)).toBe(true);
    expect(appendix).toContain("TRANSKRIPT-REST seit der stehenden Übergabe: 0 Einträge, 16 ältere ausgelassen");
  });

  test("passt alles, bleibt der Rest unberührt", () => {
    const tail = tailOf();
    const withRoom = freshSuccessionAppendix(standing("kurz"), tail, 5_000, "generic", null, "owner", PASTE_MAX_BYTES);
    expect(withRoom).toBe(freshSuccessionAppendix(standing("kurz"), tail, 5_000, "generic", null, "owner"));
  });

  test("tailThatFits nimmt die jüngsten Teile und kürzt nie mitten in einem", () => {
    expect(tailThatFits(["aaaa", "bbbb", "cccc"], 9)).toEqual({ kept: ["bbbb", "cccc"], dropped: 1 });
    expect(tailThatFits(["ä".repeat(10)], 19)).toEqual({ kept: [], dropped: 1 });
    expect(tailThatFits(["ä".repeat(10)], 20)).toEqual({ kept: ["ä".repeat(10)], dropped: 0 });
  });
});

describe("die Absicht hat zwei Deckel: 10 000 Zeichen und 20 000 Bytes", () => {
  test("10 000 Mehrbyte-Zeichen (CJK, 30 000 Bytes) passen nicht, 10 000 ä (20 000 Bytes) und 10 000 ASCII ja", () => {
    expect(lineageIntentFits("界".repeat(LINEAGE_INTENT_MAX))).toBe(false);
    expect(lineageIntentFits("ä".repeat(LINEAGE_INTENT_MAX))).toBe(true);
    expect(lineageIntentFits("x".repeat(LINEAGE_INTENT_MAX))).toBe(true);
    expect(lineageIntentFits("x".repeat(LINEAGE_INTENT_MAX + 1))).toBe(false);
  });
  test("der Lader liest dieselbe Grenze wie die Tür", () => {
    expect(standingHandoverFrom(standing("ä".repeat(10_000)), 7)?.intent).toHaveLength(10_000);
    expect(standingHandoverFrom(standing("界".repeat(10_000)), 7)).toBeNull();
  });
});

// Owner 30.10.: „[Zitat entfernt]“ ist an gewissen Stellen nicht mehr zeitgemäß. Zwei Stellen, an denen ein Sitz
// sagen muss, was er zu sagen hat, und der Empfänger es ganz bekommt: der Postfach-Text und die stehende Übergabe.
import { describe, expect, test } from "bun:test";
import { planPostfachDelivery, postfachEntryText, type PostfachEntry } from "./postfach-zustellen";
import { loadMessagePayload, standingHandoverFrom } from "./types";

const text = (n: number) => "ä界x ".repeat(Math.ceil(n / 4)).slice(0, n);

describe("Postfach-Text: ein Bericht geht in einem Stück", () => {
  test("ein Text von 9 000 Zeichen ist eine Nachricht, nicht drei nummerierte Teile", () => {
    expect(loadMessagePayload({ kind: "text", text: text(9_000) }, "payload")).toEqual({ kind: "text", text: text(9_000) });
  });
  test("der Deckel steht bei 10 000 und nennt sich im Satz", () => {
    expect(loadMessagePayload({ kind: "text", text: text(10_000) }, "payload")).toEqual({ kind: "text", text: text(10_000) });
    expect(loadMessagePayload({ kind: "text", text: text(10_001) }, "payload"))
      .toBe("payload text must be a non-empty string of at most 10000 chars");
  });
  test("eine lange Nachricht kommt ganz an und allein, die kürzere dahinter wartet auf den nächsten Takt", () => {
    const entry = (id: string, at: number, n: number): PostfachEntry =>
      ({ id, at, from: "slot 3", target: { kind: "session", slot: 4, openedAt: 1 }, text: text(n) });
    const lang = entry("a", 1, 9_500);
    const plan = planPostfachDelivery([lang, entry("b", 2, 100)], 1_000_000, { windowMs: 0, maxChars: 8_000 });
    expect(plan?.entries.map((e) => e.id)).toEqual(["a"]);
    expect(plan?.text).toBe(postfachEntryText(lang));
    expect(plan?.text.includes(lang.text)).toBe(true);
  });
});

describe("stehende Übergabe: die Absicht der Vorgängerin kommt ganz an", () => {
  const stand = (intent: string) => ({ at: 5, openedAt: 7, intent, pointer: null, ahead: null });
  test("eine Absicht von 9 000 Zeichen wird geladen, nicht verworfen", () => {
    expect(standingHandoverFrom(stand(text(9_000)), 7)?.intent).toBe(text(9_000));
  });
  test("über 10 000 Zeichen wird sie nicht geladen", () => {
    expect(standingHandoverFrom(stand(text(10_000)), 7)?.intent).toBe(text(10_000));
    expect(standingHandoverFrom(stand(text(10_001)), 7)).toBeNull();
  });
});

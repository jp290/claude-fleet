// Neuaufbau K9 · S1. Owner 13.10.: „[Zitat entfernt]“ — der Knopf sagt in einem Satz,
// was die Nachfolgerin bekommt („[Zitat entfernt]“ oder „[Zitat entfernt]“
// ). Bauleitung 13.10.: Die Einstellung gilt für die ganze Linie im Slot (Frage 2).
import { describe, expect, test } from "bun:test";
import { agoText, ownSetting, settingForSuccessor, successorSentence, type SucceedPreviewFacts } from "./succession";
import type { HandoverSetting } from "./types";

const setting = (slot: number, openedAt: number): HandoverSetting => ({ thresholdPct: 55, nudge: false, keepCache: true,
  keepCacheIdleMin: 45, warmBound: true, setAt: 1, occupant: { slot, openedAt } });

describe("die Einstellung der Linie", () => {
  test("die eigene Einstellung der gehenden Besetzung geht unverändert auf die Nachfolgerin über", () => {
    const own = ownSetting(setting(3, 100), { slot: 3, openedAt: 100 });
    const next = settingForSuccessor(own, { slot: 3, openedAt: 200 }, 999);
    expect(next).toEqual({ thresholdPct: 55, nudge: false, keepCache: true, keepCacheIdleMin: 45, warmBound: true,
      setAt: 999, occupant: { slot: 3, openedAt: 200 } });
  });
  test("eine Einstellung, die eine andere Besetzung nennt, geht nicht mit", () => {
    expect(ownSetting(setting(3, 100), { slot: 3, openedAt: 101 })).toBeNull();
    expect(ownSetting(setting(4, 100), { slot: 3, openedAt: 100 })).toBeNull();
    expect(settingForSuccessor(null, { slot: 3, openedAt: 200 }, 999)).toBeNull();
  });
  test("die Vorlage bleibt stehen", () => {
    const own = Object.freeze(setting(3, 100));
    settingForSuccessor(own, { slot: 3, openedAt: 200 }, 999);
    expect(own.occupant.openedAt).toBe(100);
  });
});

describe("was die Nachfolgerin bekommt", () => {
  const ready = (o: Partial<SucceedPreviewFacts>): SucceedPreviewFacts => ({ refusal: null, rail: "generic",
    standingHandover: null, tail: { state: "read", entries: 0, omitted: 0 }, ...o });
  test("stehende Übergabe und Rest", () => {
    expect(successorSentence(ready({ standingHandover: { ageMs: 12 * 60_000 }, tail: { state: "read", entries: 9, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt die stehende Übergabe von vor 12 min und 9 Einträge Transkript-Rest.");
  });
  test("ohne Übergabe nur der Transkript-Rest, und der Satz sagt es", () => {
    expect(successorSentence(ready({ tail: { state: "read", entries: 1, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt 1 Eintrag Transkript-Rest; eine Übergabe hat die Session nicht geschrieben.");
    expect(successorSentence(ready({ tail: { state: "read", entries: 30, omitted: 12 } })))
      .toBe("Die Nachfolgerin bekommt 30 Einträge Transkript-Rest (12 ältere ausgelassen); eine Übergabe hat die Session nicht geschrieben.");
  });
  test("eine Übergabe ohne Rest danach, und die Program-Schiene", () => {
    expect(successorSentence(ready({ standingHandover: { ageMs: 30_000 } })))
      .toBe("Die Nachfolgerin bekommt die stehende Übergabe von eben.");
    expect(successorSentence(ready({ rail: "program", standingHandover: { ageMs: 3 * 3_600_000 }, tail: { state: "read", entries: 2, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt den Program-Eintrag, die stehende Übergabe von vor 3 h und 2 Einträge Transkript-Rest.");
  });
  test("nichts zu lesen ist nur der Start-Brief, ein unlesbares Transkript wird genannt", () => {
    expect(successorSentence(ready({}))).toBe("Die Nachfolgerin bekommt nur ihren Start-Brief; eine Übergabe hat die Session nicht geschrieben.");
    expect(successorSentence(ready({ standingHandover: { ageMs: 5 * 60_000 }, tail: { state: "none", entries: 0, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt die stehende Übergabe von vor 5 min; das Transkript kann Fleet nicht lesen.");
  });
  test("eine abgewiesene Tür sagt den Grund in Worten", () => {
    expect(successorSentence(ready({ refusal: { reason: "busy" } }))).toBe("Geht gerade nicht: sie arbeitet gerade; sobald sie ruht, geht es.");
    expect(successorSentence(ready({ refusal: { reason: "lane" } }))).toBe("Geht gerade nicht: eine Lane gibt aus ihrer eigenen Session weiter, mit Übergabebericht.");
    expect(successorSentence(ready({ refusal: { reason: "neu" } }))).toBe("Geht gerade nicht: neu.");
  });
  test("das Alter in Worten", () => {
    expect([0, 59_000, 60_000, 89 * 60_000, 90 * 60_000, 47 * 3_600_000, 48 * 3_600_000, 72 * 3_600_000].map(agoText))
      .toEqual(["eben", "eben", "vor 1 min", "vor 89 min", "vor 2 h", "vor 47 h", "vor 2 Tagen", "vor 3 Tagen"]);
  });
});

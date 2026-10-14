// Neuaufbau K9 · S1. Owner 13.10.: „[Zitat entfernt]“ — der Knopf sagt in einem Satz,
// was die Nachfolgerin bekommt („[Zitat entfernt]“ oder „[Zitat entfernt]“
// ). Bauleitung 13.10.: Die Einstellung gilt für die ganze Linie im Slot (Frage 2).
// S2, Owner 13.10.: „[Zitat entfernt]“ — ein Schalter, eine
// Entscheidung, warm/kalt aus dem Transkript. S2b, Owner 13.10.: „[Zitat entfernt]“
//  — der eigene Text des Warm-Turns, nur Text, ohne Zugangsdaten.
import { describe, expect, test } from "bun:test";
import { agoText, cacheView, ownSetting, settingForSuccessor, successorSentence, warmDecision, warmTextInput,
  type SucceedPreviewFacts, type WarmFacts } from "./succession";
import { loadHandoverSetting, type HandoverSetting } from "./types";

const setting = (slot: number, openedAt: number): HandoverSetting => ({ thresholdPct: 55, nudge: false, keepCache: true,
  keepCacheIdleMin: 45, keepCacheText: "Lies den Stand und antworte mit einem Satz.", setAt: 1, occupant: { slot, openedAt } });

describe("die Einstellung der Linie", () => {
  test("die eigene Einstellung der gehenden Besetzung geht unverändert auf die Nachfolgerin über", () => {
    const own = ownSetting(setting(3, 100), { slot: 3, openedAt: 100 });
    const next = settingForSuccessor(own, { slot: 3, openedAt: 200 }, 999);
    expect(next).toEqual({ thresholdPct: 55, nudge: false, keepCache: true, keepCacheIdleMin: 45,
      keepCacheText: "Lies den Stand und antworte mit einem Satz.", setAt: 999, occupant: { slot: 3, openedAt: 200 } });
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

describe("warm oder kalt", () => {
  const MIN = 60_000;
  test("bis zum Ende der Stufe warm, danach kalt; die Stufe kommt aus dem Transkript", () => {
    expect(cacheView(0, 3600, null, 59 * MIN)).toEqual({ state: "warm", lastCallAt: 0, ttlSec: 3600, coldAt: 60 * MIN });
    expect(cacheView(0, 3600, null, 61 * MIN).state).toBe("kalt");
    expect(cacheView(0, 300, null, 6 * MIN).state).toBe("kalt");
  });
  test("eine Kompaktierung nach dem letzten Aufruf heißt kompaktiert, eine davor zählt nicht", () => {
    expect(cacheView(10 * MIN, 3600, 64 * MIN, 70 * MIN).state).toBe("kompaktiert");
    expect(cacheView(10 * MIN, 3600, 5 * MIN, 20 * MIN).state).toBe("warm");
  });
  test("ohne gelesenen Aufruf unbekannt", () => {
    expect(cacheView(null, 300, null, 1)).toEqual({ state: "unbekannt", lastCallAt: null, ttlSec: 300, coldAt: null });
  });
});

describe("die Warm-Entscheidung", () => {
  const MIN = 60_000;
  const on = (o: Partial<WarmFacts> = {}): WarmFacts => ({ on: true, asleep: false, pinned: true, lastCallAt: 0, tier: "1h",
    compactedAt: null, idleMin: 50, lifetimeMin: 60, warmTurns: 0, warmMax: 24, warmLastHour: 0, hourCap: 2, ...o });
  test("an, nach der Ruhezeit und vor dem Verfall: ein Warm-Turn", () => {
    expect(warmDecision(on(), 51 * MIN)).toEqual({ act: "warm", reason: "due", lastUsageAt: 0, dueAt: 50 * MIN });
  });
  test("aus: keiner", () => {
    expect(warmDecision(on({ on: false }), 51 * MIN)).toEqual({ act: null, reason: "off", lastUsageAt: null, dueAt: null });
  });
  test("vor der Ruhezeit nichts, nach dem Verfall nichts (ein kalter Cache wird nicht gewärmt)", () => {
    expect(warmDecision(on(), 49 * MIN)).toMatchObject({ act: null, reason: "before-duration", dueAt: 50 * MIN });
    expect(warmDecision(on(), 61 * MIN)).toMatchObject({ act: null, reason: "expired" });
  });
  test("5-min-Stufe, Kompaktierung, schlafend, ohne Gespräch, ohne Aufruf: keiner, mit Namen", () => {
    expect(warmDecision(on({ tier: "5m" }), 51 * MIN).reason).toBe("cache-5m");
    expect(warmDecision(on({ compactedAt: 40 * MIN }), 51 * MIN).reason).toBe("compacted");
    expect(warmDecision(on({ asleep: true }), 51 * MIN).reason).toBe("asleep");
    expect(warmDecision(on({ pinned: false }), 51 * MIN).reason).toBe("unpinned");
    expect(warmDecision(on({ lastCallAt: null }), 51 * MIN).reason).toBe("no-usage");
  });
  test("die Deckel: ohne eigenen Turn und je Stunde", () => {
    expect(warmDecision(on({ warmTurns: 24 }), 51 * MIN).reason).toBe("warm-cap");
    expect(warmDecision(on({ warmLastHour: 2 }), 51 * MIN).reason).toBe("hour-cap");
    expect(warmDecision(on({ warmLastHour: 1 }), 51 * MIN).act).toBe("warm");
  });
});

describe("der Text des Warm-Turns", () => {
  const FLEET = "[fleet] Cache warmhalten. Antworte nur mit „ok“ — beginne nichts, rufe kein Werkzeug auf.";
  const TOKEN = "f1e2d3c4b5a6978877665544";
  const input = (v: unknown) => warmTextInput(v, FLEET, [TOKEN, "1"]);
  test("ein eigener Text wird gespeichert, getrimmt, auch mit Zeilenumbruch", () => {
    expect(input("  Lies HANDOVER.md und nenne den nächsten Schritt.\nNichts bauen.  "))
      .toEqual({ ok: true, text: "Lies HANDOVER.md und nenne den nächsten Schritt.\nNichts bauen." });
  });
  test("null, leer oder der Fleet-Text selbst heißt Fleet-Standard und speichert nichts", () => {
    expect(input(null)).toEqual({ ok: true, text: null });
    expect(input("   ")).toEqual({ ok: true, text: null });
    expect(input(FLEET)).toEqual({ ok: true, text: null });
  });
  test("nur Text: kein anderer Typ, kein Steuerzeichen, kein Befehl, nicht über dem Deckel", () => {
    for (const v of [42, true, ["ok"], "a\u001b[2Jb", "a\tb", "a\rb", "/clear", "!rm -rf .", "x".repeat(501)])
      expect(input(v)).toEqual({ ok: false, refusal: "bad-keep-cache-text" });
    expect(input("x".repeat(500))).toEqual({ ok: true, text: "x".repeat(500) });
  });
  test("keine Zugangsdaten dieser Fleet; ein kurzer Env-Wert zählt nicht", () => {
    expect(input(`bitte ${TOKEN} benutzen`)).toEqual({ ok: false, refusal: "keep-cache-secret" });
    expect(input("Version 1 lesen")).toEqual({ ok: true, text: "Version 1 lesen" });
  });
  test("fleet.json: ein Datensatz ohne Feld liest null, ein kaputter Text verwirft den Datensatz", () => {
    const rec = { thresholdPct: null, nudge: true, keepCache: true, keepCacheIdleMin: 50, setAt: 1, occupant: { slot: 3, openedAt: 100 } };
    expect(loadHandoverSetting(rec)?.keepCacheText).toBeNull();
    expect(loadHandoverSetting({ ...rec, keepCacheText: "Stand lesen." })?.keepCacheText).toBe("Stand lesen.");
    expect(loadHandoverSetting({ ...rec, keepCacheText: "/clear" })).toBeNull();
    expect(loadHandoverSetting({ ...rec, keepCacheText: 7 })).toBeNull();
  });
});

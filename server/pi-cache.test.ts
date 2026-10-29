// Die Cache-Anzeige eines Pi-Sitzes: die Sitzungsdatei nennt den letzten Modellaufruf und seine
// Cache-Zähler, die Tabelle in server/pi-cache.ts nennt die gemessene Lebensdauer des Anbieters.
// Warm ist nur, was kürzer als diese Dauer zurückliegt und einen Cache-Anteil hatte; ohne Messung
// bleibt es „unbekannt“, und der Warm-Turn fällt bei stundenlangen wie bei ungemessenen Caches weg.
import { describe, expect, test } from "bun:test";
import { measuredCacheLifetime, piCacheFact, piCacheState, piLastUsage } from "./pi-cache";
import { PI_SESSION_DEEPSEEK, piSessionWithLastUsage } from "./pi-cache.fixtures";
import { warmDecision, type WarmFacts } from "./succession";

const MIN = 60_000;
const H = 60 * MIN;
const LAST_AT = Date.parse("2026-10-29T09:04:49.135Z");

describe("der letzte Aufruf aus der pi-Sitzungsdatei", () => {
  test("liest den jüngsten Assistant-Aufruf und nennt seinen Anbieter", () => {
    const use = piLastUsage(PI_SESSION_DEEPSEEK);
    expect(use).toEqual({ at: LAST_AT, provider: "deepseek", input: 1224, cacheRead: 57600, cacheWrite: 0 });
    expect(measuredCacheLifetime(use!.provider)?.ttlSec).toBe(6 * 3600);
  });

  test("ein späterer User- oder Tool-Turn macht den Aufruf nicht neuer", () => {
    const later = [...PI_SESSION_DEEPSEEK,
      JSON.stringify({ type: "message", id: "u2", parentId: "f1254d47", timestamp: "2026-10-29T09:05:00.000Z",
        message: { role: "user", content: "next" } })];
    expect(piLastUsage(later)?.at).toBe(LAST_AT);
  });
});

describe("warm, kalt, unbekannt", () => {
  test("deepseek mit Cache-Anteil ist warm und nennt die Quelle der Dauer", () => {
    const fact = piCacheFact(piLastUsage(PI_SESSION_DEEPSEEK));
    expect(fact).toEqual({ at: LAST_AT, ttlSec: 6 * 3600, ttlQuelle: "gemessen 2026-10-29, 391 Aufrufe, deepseek-flash" });
    expect(piCacheState(fact, LAST_AT + 5 * H)).toBe("warm");
    expect(piCacheState(fact, LAST_AT + 6 * H)).toBe("kalt");
  });

  test("ohne Cache-Anteil ist der Aufruf kalt, auch wenn der Anbieter gemessen ist", () => {
    const use = piLastUsage(piSessionWithLastUsage({ input: 1200, output: 100, cacheRead: 0, cacheWrite: 0 }));
    const fact = piCacheFact(use);
    expect(fact.ttlSec).toBe(0);
    expect(fact.at).toBe(LAST_AT);
    expect(piCacheState(fact, LAST_AT + MIN)).toBe("kalt");
  });

  test("ein ungemessener Anbieter zeigt unbekannt, nie einen geratenen TTL", () => {
    const use = piLastUsage(piSessionWithLastUsage({ input: 1200, output: 100, cacheRead: 50000, cacheWrite: 0 }, "zai"));
    const fact = piCacheFact(use);
    expect(fact).toEqual({ at: null, ttlSec: 300, ttlQuelle: "unknown" });
    expect(piCacheState(fact, LAST_AT + MIN)).toBe("unbekannt");
  });

  test("eine Datei ohne nutzbaren Aufruf bleibt unbekannt", () => {
    expect(piLastUsage(PI_SESSION_DEEPSEEK.slice(0, 2))).toBeNull();
    expect(piCacheFact(null)).toEqual({ at: null, ttlSec: 300, ttlQuelle: "unknown" });
  });
});

describe("kein Warm-Turn für stundenlange oder ungemessene Caches", () => {
  const facts = (o: Partial<WarmFacts> = {}): WarmFacts => ({ on: true, asleep: false, pinned: true, lastCallAt: LAST_AT,
    tier: "1h", compactedAt: null, idleMin: 50, lifetimeMin: 60, warmTurns: 0, warmMax: 24, warmLastHour: 0, hourCap: 2, ...o });

  test("deepseek: die gemessene Sechs-Stunden-Dauer plant keinen Puls", () => {
    const fact = piCacheFact(piLastUsage(PI_SESSION_DEEPSEEK));
    const d = warmDecision(facts({ tier: fact.ttlQuelle, lastCallAt: fact.at }), LAST_AT + 51 * MIN);
    expect(d).toEqual({ act: null, reason: "cache-long", lastUsageAt: LAST_AT, dueAt: null });
  });

  test("ein ungemessener Anbieter plant keinen Puls", () => {
    const d = warmDecision(facts({ tier: "unknown" }), LAST_AT + 51 * MIN);
    expect(d).toEqual({ act: null, reason: "cache-unknown", lastUsageAt: LAST_AT, dueAt: null });
  });

  test("eine kurze gemessene Stufe pulst weiter", () => {
    expect(warmDecision(facts(), LAST_AT + 51 * MIN)).toMatchObject({ act: "warm", reason: "due" });
  });
});

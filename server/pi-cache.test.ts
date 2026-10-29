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

describe("eine Usage-Zeile ohne Zeitstempel (e2e/watch.ts, e2e/security.ts: pi-Fixtures)", () => {
  // genau die Zeile aus e2e/watch.ts:7806 — weder `message.timestamp` noch `timestamp` an der Zeile, kein Anbieter
  const ZEILE_WATCH = JSON.stringify({ type: "message", message: { role: "assistant", usage: { input: 29_200,
    output: 9_000_000, cacheRead: 100_000, cacheWrite: 0, reasoning: 0, totalTokens: 9_129_200 } } });

  test("die Zähler zählen weiter, nur die Cache-Uhr ist unbekannt", () => {
    const use = piLastUsage([ZEILE_WATCH]);
    expect(use).toEqual({ at: null, provider: null, input: 29_200, cacheRead: 100_000, cacheWrite: 0 });
    // der Zähler des Kontexts (server.ts#readPiUsedTokens): input + cacheRead + cacheWrite = 129 200, die Hälfte von 258 400
    expect(use!.input + use!.cacheRead + use!.cacheWrite).toBe(129_200);
    expect(piCacheFact(use)).toEqual({ at: null, ttlSec: 300, ttlQuelle: "unknown" });
    expect(piCacheState(piCacheFact(use), LAST_AT)).toBe("unbekannt");
  });

  test("auch bei einem gemessenen Anbieter gibt eine Zeile ohne Zeitstempel keine Cache-Uhr", () => {
    const use = piLastUsage([JSON.stringify({ type: "message", message: { role: "assistant", provider: "deepseek",
      usage: { input: 10, cacheRead: 500, cacheWrite: 0 } } })]);
    expect(use?.cacheRead).toBe(500);
    expect(piCacheFact(use).at).toBeNull();
  });

  test("sie ist nicht die ältere Zeile mit Zeitstempel: die jüngste Zeile gewinnt", () => {
    const use = piLastUsage([...PI_SESSION_DEEPSEEK, ZEILE_WATCH]);
    expect(use?.input).toBe(29_200);
  });
});

describe("das Etikett der Dauer sagt, was belegt ist und was gewählt", () => {
  // 391 Aufrufe belegen Treffer bis 8,75 h, nicht eine Lebensdauer von 6 h: die 6 h sind eine vorsichtige Wahl darunter (Leitung 29.10.)
  test("deepseek: die Quelle nennt den beobachteten Wert und die gewählte Dauer getrennt", () => {
    const m = measuredCacheLifetime("deepseek")!;
    expect(m.ttlSec).toBe(6 * 3600);
    expect(m.quelle).toContain("Treffer bis 8,75 h beobachtet");
    expect(m.quelle).toContain("6 h vorsichtig gewählt");
    expect(m.quelle).not.toMatch(/^gemessen/);
  });
});

describe("warm, kalt, unbekannt", () => {
  test("deepseek mit Cache-Anteil ist warm und nennt die Quelle der Dauer", () => {
    const fact = piCacheFact(piLastUsage(PI_SESSION_DEEPSEEK));
    expect(fact).toEqual({ at: LAST_AT, ttlSec: 6 * 3600, ttlQuelle: "Treffer bis 8,75 h beobachtet (2026-10-29, 391 Aufrufe, deepseek-flash), 6 h vorsichtig gewählt" });
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
    const d = warmDecision(facts({ pi: true, tier: fact.ttlQuelle, lastCallAt: fact.at }), LAST_AT + 51 * MIN);
    expect(d).toEqual({ act: null, reason: "cache-long", lastUsageAt: LAST_AT, dueAt: null });
  });

  test("ein ungemessener Anbieter plant keinen Puls", () => {
    const d = warmDecision(facts({ pi: true, tier: "unknown" }), LAST_AT + 51 * MIN);
    expect(d).toEqual({ act: null, reason: "cache-unknown", lastUsageAt: LAST_AT, dueAt: null });
  });

  // EIN CLAUDE-SITZ ENTSCHEIDET WIE AUF MAIN: seine Stufe „unknown“ heißt „kein cache_creation-Beleg im Tail“, nicht „ungemessener
  // Anbieter“ — er bekam seine Warm-Entscheidung schon vorher und bekommt sie weiter (Leitung 29.10.: die zwei neuen Zweige gelten nur
  // für einen pi-Cache-Stand, die Claude-Sitze hat Zug C nicht zu ändern gebeten)
  test("Claude, Stufe unknown, Puls fällig: derselbe Warm-Turn wie vorher", () => {
    expect(warmDecision(facts({ tier: "unknown" }), LAST_AT + 51 * MIN)).toMatchObject({ act: "warm", reason: "due" });
  });

  test("Claude, Stufe unknown, vor der Dauer: wartet wie vorher", () => {
    expect(warmDecision(facts({ tier: "unknown" }), LAST_AT + 10 * MIN)).toMatchObject({ act: null, reason: "before-duration" });
  });

  test("eine kurze gemessene Stufe pulst weiter", () => {
    expect(warmDecision(facts(), LAST_AT + 51 * MIN)).toMatchObject({ act: "warm", reason: "due" });
  });
});

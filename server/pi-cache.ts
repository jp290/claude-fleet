// THE PROMPT CACHE OF A PI SESSION. Pi keeps no Claude Code transcript, but every assistant row of
// its session file carries the provider's own usage counters (input / cacheRead / cacheWrite) and the
// request's timestamp. That is the fact the board's cache reading needs: when the newest model call
// ran, whether it hit the cache, and how long the provider's cache survives.
//
// The lifetime is NEVER guessed. It is a table keyed by the provider the session file names, and each
// row says WHAT backs its number; a provider without a row stays unknown, and the board says "unbekannt"
// rather than inventing a number. DeepSeek: observed (2026-10-29, 391 calls on deepseek-flash: cacheRead
// share 0.99–1.00 through pauses up to 60 min, hits up to 8.75 h) — an observed hit is a lower bound on
// the lifetime, not the lifetime, so 6 h is a CAUTIOUS CHOICE below it, and the row says so. Its own
// guide says "usually within a few hours to a few days". GLM (zai) has no measurement on this host, so
// it has no row.
export interface PiUsage {
  // message.timestamp when the file carries it, else the line's own timestamp (Unix ms); null when the
  // row carries neither — the counters still count (the context numerator reads them), only the cache
  // clock is unknown
  at: number | null;
  provider: string | null;
  input: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface MeasuredCacheLifetime {
  ttlSec: number;
  // what the number rests on — carried on the fact (DeliveryCacheFact.ttlQuelle) so a reader can see
  // the observation and the choice made from it instead of taking the number on faith
  quelle: string;
}

const MEASURED_CACHE_LIFETIME: Readonly<Record<string, MeasuredCacheLifetime>> = {
  deepseek: { ttlSec: 6 * 3600, quelle: "Treffer bis 8,75 h beobachtet (2026-10-29, 391 Aufrufe, deepseek-flash), 6 h vorsichtig gewählt" },
};

export function measuredCacheLifetime(provider: string | null | undefined): MeasuredCacheLifetime | null {
  if (!provider || !Object.prototype.hasOwnProperty.call(MEASURED_CACHE_LIFETIME, provider)) return null;
  return MEASURED_CACHE_LIFETIME[provider];
}

// The newest assistant row that carries all three usage counters, walked back from the END of the
// file. Same contract as the context numerator (server.ts#readPiUsedTokens): the newest parseable
// row is the answer, a row missing a counter is skipped, and a torn first line of a tail simply
// fails to parse and the walk goes on. A row WITHOUT a timestamp is NOT skipped: the numerator reads
// its counters, and skipping it here would make the context reading fall back to an older row. Its
// `at` is null. `null` = no such row in what was read.
export function piLastUsage(lines: readonly string[]): PiUsage | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    let row: { type?: unknown; timestamp?: unknown; message?: { role?: unknown; timestamp?: unknown;
      provider?: unknown; usage?: unknown } };
    try { row = JSON.parse(lines[i]) as typeof row; }
    catch { continue; } // torn first line of the tail
    if (row.type !== "message" || row.message?.role !== "assistant") continue;
    const u = row.message.usage;
    if (typeof u !== "object" || u === null) continue;
    const num = (k: string): number | null => {
      const v = (u as Record<string, unknown>)[k];
      return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    };
    const input = num("input"), cacheRead = num("cacheRead"), cacheWrite = num("cacheWrite");
    if (input === null || cacheRead === null || cacheWrite === null) continue;
    const stamp = row.message.timestamp ?? row.timestamp;
    const parsed = typeof stamp === "number" ? stamp : typeof stamp === "string" ? Date.parse(stamp) : NaN;
    const at = Number.isFinite(parsed) ? parsed : null;
    const provider = typeof row.message.provider === "string" && row.message.provider ? row.message.provider : null;
    return { at, provider, input, cacheRead, cacheWrite };
  }
  return null;
}

// The cache fact in the shape the delivery path already speaks (server.ts#DeliveryCacheFact). A
// provider this host has not measured yields `unknown` with no `at`: an unknown provider is not a
// warm cache and not a cold one. A call whose cache portion was ZERO wrote nothing reusable, so its
// lifetime is 0 and the reading is cold — while `at` stays the real call time. A call with no
// timestamp has no cache clock: `unknown`, like an unmeasured provider.
export interface PiCacheFact { at: number | null; ttlSec: number; ttlQuelle: string }
export function piCacheFact(last: PiUsage | null): PiCacheFact {
  if (!last || last.at === null) return { at: null, ttlSec: 300, ttlQuelle: "unknown" };
  const measured = measuredCacheLifetime(last.provider);
  if (!measured) return { at: null, ttlSec: 300, ttlQuelle: "unknown" };
  if (last.cacheRead <= 0) return { at: last.at, ttlSec: 0, ttlQuelle: measured.quelle };
  return { at: last.at, ttlSec: measured.ttlSec, ttlQuelle: measured.quelle };
}

export type PiCacheState = "warm" | "kalt" | "unbekannt";
// warm = the last call had a cache portion and ran less than the measured lifetime ago; cold = a
// measured provider whose cache has lapsed or whose last call had no cache portion; unknown = no
// measurement for this provider (or no call at all) — never a guessed warm or cold.
export function piCacheState(fact: PiCacheFact, now: number): PiCacheState {
  if (fact.at === null) return "unbekannt";
  return fact.ttlSec > 0 && now < fact.at + fact.ttlSec * 1000 ? "warm" : "kalt";
}

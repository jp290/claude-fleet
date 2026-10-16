// WHAT HAPPENS TO THIS SESSION NEXT, AND WHEN (K16, auftraege/uebergabe-b-englisch.md; src/handover-now.ts#flowSteps). Owner
// 16.10.: Fleet nudges the session to lead its own succession (12:2x); see whether and when it was nudged, a raised threshold
// told to the session (10:5x, Z50); the 5-point window stays visible (17:5x); „[Zitat entfernt]“ (18:2x).
// Runde C (19:3x, 21:1x): „[Zitat entfernt]“, nudged once and not three times, and nothing typed into a cold cache —
// there the block offers a new session from a summary.
// Every line answers „what happens next, and when“ — in English, one sentence — and nothing Fleet did not read is claimed.
import { describe, expect, test } from "bun:test";
import type { BriefSuccession } from "../src/board";
import { OFF_WHY, flowSteps, laterText, nowText, nudgedText, planOf, planWrite, type Step } from "../src/handover-now";

const NOW = new Date(2026, 9, 16, 14, 0).getTime();
const MIN = 60_000;
const fill = (pct: number) => ({ usedTokens: pct * 10_000, windowTokens: 1_000_000, pct });
// a Bau-Session with the fleet's values: nudged at 40, a new session at 45 (server/succession.ts#fleetChoiceOf)
const bau = (o: Partial<BriefSuccession> = {}): BriefSuccession => ({
  rail: "handoff", kind: "bau", fill: fill(30), thresholdPct: 40, capPct: 45, thresholdOff: null, defaultPct: 40, pctFrom: "fleet",
  sessionPct: null, nudgeOn: true, nudges: 0, nudgedAt: null, nudgedPct: null, gaveUp: false, maxNudges: 1, session: 1, taken: null,
  cap: null, atThreshold: "succeed", fleetChoice: "succeed", choices: ["hint", "compact", "succeed"], act: null,
  cache: { state: "warm", lastCallAt: NOW - 5 * MIN, ttlSec: 3600, coldAt: NOW + 55 * MIN },
  keepCache: { on: false, from: "fleet", fleetOn: false, exempt: null, idleMin: 50, lifetimeMin: 60, hourCap: 2, warmTurns: 0 },
  autoCompact: false, ...o,
});
const lane = (o: Partial<BriefSuccession> = {}): BriefSuccession => bau({ rail: "lane", kind: "lane", thresholdPct: 37, capPct: 42,
  defaultPct: 37, atThreshold: "hint", fleetChoice: "hint", choices: ["hint", "compact"],
  keepCache: { on: false, from: "fleet", fleetOn: false, exempt: "lane", idleMin: 50, lifetimeMin: 60, hourCap: 2, warmTurns: 0 }, ...o });
const cold = { state: "kalt" as const, lastCallAt: NOW - 70 * MIN, ttlSec: 3600, coldAt: NOW - 10 * MIN };
const kept = (o: Partial<NonNullable<BriefSuccession["keepCache"]>> = {}) => ({ on: true, from: "fleet" as const, fleetOn: true,
  exempt: null, idleMin: 50, lifetimeMin: 60, hourCap: 2, warmTurns: 1, warmMax: 3, dueAt: NOW + 45 * MIN, reason: "before-duration", ...o });
const steps = (s: BriefSuccession, handoverAt?: number): Step[] => flowSteps(s, { now: NOW, lane: s.kind === "lane", handoverAt });
const step = (s: BriefSuccession, id: Step["id"], handoverAt?: number) => steps(s, handoverAt).find((x) => x.id === id);
const said = (s: BriefSuccession): string[] => steps(s).map((x) => `${x.when} · ${x.what}`);

describe("what happens next, and when", () => {
  test("a Bau-Session below the threshold: Fleet nudges once at 40, starts a new session at 45, the cache in one line", () => {
    expect(said(bau())).toEqual([
      "40 % · Fleet nudges the session once to succeed.",
      "45 % · Fleet starts a new session if it hasn't succeeded yet.",
      "Cache · Warm until 14:55 · not kept warm · auto-compact off.",
    ]);
    expect(step(bau(), "nudge")?.status).toBe("10 % to go");
  });
  test("the 5-point window stays visible: up to 45 only while the cache is warm — until Fleet's lead before it goes cold", () => {
    expect(step(bau(), "act")?.why).toBe("Up to 45 % only until 14:45, before the cache goes cold.");
    expect(step(bau({ keepCache: kept() }), "act")?.why).toBe("Fleet keeps the cache warm, so the session has until 45 %.");
    expect(step(bau({ cache: cold }), "act")?.why).toBe("The cache is cold: start a new session from a summary below, or Fleet does it at the cap.");
  });
  test("Z50: once nudged, the nudge line says when and at what fill instead of the distance — the one nudge is no „no more“", () => {
    const nudged = bau({ fill: fill(42), nudges: 1, nudgedAt: NOW - 3 * MIN, nudgedPct: 41, gaveUp: true });
    expect(step(nudged, "nudge")?.status).toBe("nudged 13:57 (41 %)");
    expect(nudgedText(bau({ nudges: 1, nudgedAt: NOW - 3 * MIN, nudgedPct: null }), NOW)).toBe("nudged 13:57");
    expect(nudgedText(bau(), NOW)).toBeNull();
  });
  test("a handover written above the threshold and under the cap holds the nudge back, and the line says so", () => {
    expect(step(bau({ fill: fill(42) }), "nudge", NOW - 2 * MIN)?.status).toBe("handover written 13:58");
    expect(step(bau({ fill: fill(42) }), "nudge")?.status).toBe("due");
  });
  test("Runde C: above the threshold with a cold cache nothing is typed and Fleet's act waits for the cap — the offer is the owner's", () => {
    expect(step(bau({ cache: cold, fill: fill(41) }), "nudge")?.status).toBe("not into a cold cache");
    expect(step(bau({ cache: cold, fill: fill(41) }), "act")).toMatchObject({ when: "45 %", status: undefined,
      why: "The cache is cold: start a new session from a summary below, or Fleet does it at the cap." });
    expect(step(bau({ cache: cold, fill: fill(46) }), "act")).toMatchObject({ when: "now", status: "due" });
    expect(step(bau({ fill: fill(46) }), "act")).toMatchObject({ when: "now", status: "due" });
  });
  test("the one nudge is said once: no line promises another", () => {
    for (const s of [bau(), bau({ fill: fill(46) }), lane(), lane({ fill: fill(43), nudges: 1, gaveUp: true, nudgedAt: NOW })])
      for (const x of steps(s)) expect(`${x.what} ${x.tip}`).not.toMatch(/times at most|asks again|nudges again|more messages/);
  });
  test("a cache about to go cold that nothing keeps warm makes the act due, a kept-warm one does not", () => {
    const cooling = { state: "warm" as const, lastCallAt: NOW - 52 * MIN, ttlSec: 3600, coldAt: NOW + 8 * MIN };
    expect(step(bau({ cache: cooling, fill: fill(41) }), "act")?.when).toBe("now");
    expect(step(bau({ cache: cooling, fill: fill(41), keepCache: kept() }), "act")?.when).toBe("45 %");
  });
  test("Compact at the cap is named as what happens", () => {
    expect(step(bau({ atThreshold: "compact" }), "act")?.what).toBe("Fleet compacts the session if it hasn't succeeded yet.");
  });
  test("a lane: Fleet nudges once and starts no new session — no line at the cap", () => {
    expect(said(lane())).toEqual([
      "37 % · Fleet nudges the session once to succeed.",
      "Cache · Warm until 14:55 · auto-compact off.",
    ]);
    expect(step(lane(), "nudge")?.tip).toContain("A lane succeeds with its own report; Fleet starts no new session.");
    expect(steps(lane({ nudges: 1, gaveUp: true, nudgedAt: NOW - MIN })).map((x) => x.id)).toEqual(["nudge", "cache"]);
  });
  test("an act Fleet is running replaces the cap line", () => {
    expect(step(bau({ fill: fill(46), act: { at: NOW - 2 * MIN, act: "succeed", outcome: "läuft" } }), "act"))
      .toMatchObject({ when: "now", what: "Fleet is starting a new session.", status: "since 13:58" });
  });
});

describe("off, and what cannot be set here", () => {
  test("off for this session: one line, Fleet won't nudge or step in, no cap line", () => {
    const off = bau({ thresholdPct: null, capPct: null, thresholdOff: "session", sessionPct: 0 });
    expect(said(off).slice(0, 1)).toEqual(["Off · Fleet won't nudge or step in."]);
    expect(steps(off).map((x) => x.id)).toEqual(["off", "cache"]);
  });
  test("the nudge switched off with nothing at the cap reads as off (Mangel 76b)", () => {
    expect(said(lane({ nudgeOn: false }))[0]).toBe("Off · Fleet won't nudge or step in.");
  });
  test("the fleet's master switch off: grey, with its reason", () => {
    expect(step(bau({ thresholdPct: null, capPct: null, thresholdOff: "fleet" }), "off"))
      .toMatchObject({ what: "Fleet runs no succession here.", why: "not switched on in this Fleet", grey: true });
  });
});

describe("the cache line: one sentence for every cache fact the server has", () => {
  test("kept warm: the next warm turn; the lid reached; Claude Code's own compaction", () => {
    expect(step(bau({ keepCache: kept() }), "cache")?.what).toBe("Warm until 14:55 · Fleet keeps it warm, next turn 14:45 · auto-compact off.");
    expect(step(bau({ keepCache: kept({ reason: "warm-cap", warmTurns: 3 }) }), "cache")?.what)
      .toBe("Warm until 14:55 · Fleet stopped keeping it warm after 3 turns · auto-compact off.");
    expect(step(bau({ autoCompact: true }), "cache")?.what).toBe("Warm until 14:55 · not kept warm · Claude Code compacts it when idle.");
    expect(step(bau({ autoCompact: null, compaction: { at: NOW - 30 * MIN, preTokens: 1, postTokens: 1, trigger: "auto", idle: true } }), "cache")?.what)
      .toBe("Warm until 14:55 · not kept warm · Claude Code compacted it at 13:30.");
    expect(step(bau({ cache: cold }), "cache")?.what).toBe("Cold since 13:50 · not kept warm · auto-compact off.");
  });
  test("what Fleet does not know is left out, not guessed", () => {
    expect(step(bau({ autoCompact: undefined }), "cache")?.what).toBe("Warm until 14:55 · not kept warm.");
    expect(step(bau({ cache: undefined }), "cache")).toBeUndefined();
  });
});

describe("the words", () => {
  const all = [bau(), bau({ fill: fill(42), nudges: 1, nudgedAt: NOW, nudgedPct: 41 }), bau({ cache: cold, fill: fill(41) }), lane(),
    bau({ keepCache: kept() }), bau({ thresholdPct: null, thresholdOff: "fleet" }), bau({ thresholdPct: null, thresholdOff: "session", sessionPct: 0 })];
  test("English throughout: no German word in what the view shows", () => {
    for (const s of all) for (const x of steps(s, NOW - MIN))
      expect(`${x.when} ${x.what} ${x.why ?? ""} ${x.status ?? ""} ${x.tip}`).not.toMatch(/[äöüßÄÖÜ]|\b(bei|noch|Schwelle|Übergabe|Hinweis|Sitzung|kalt)\b/);
  });
  test("Runde C: „Nudge“, never „ask“, in what the view shows", () => {
    for (const s of all) for (const x of steps(s, NOW - MIN))
      expect(`${x.when} ${x.what} ${x.why ?? ""} ${x.status ?? ""} ${x.tip}`).not.toMatch(/\bask/i);
  });
  // owner 16.10. 22:5x: „[Zitat entfernt]“ — the act is Fleet's succession; „[Zitat entfernt]“ stays only for
  // the written standing handover (POST /api/self/handover)
  test("the act is „succeed“, never „hand over“", () => {
    for (const s of all) for (const x of steps(s, NOW - MIN))
      expect(`${x.when} ${x.what} ${x.why ?? ""} ${x.status ?? ""} ${x.tip}`).not.toMatch(/\bhand(s|ed|ing)? over\b/i);
    for (const why of Object.values(OFF_WHY)) expect(why).not.toMatch(/\bhand(s|ed|ing)? over\b/i);
    expect(step(bau(), "nudge")?.what).toBe("Fleet nudges the session once to succeed.");
  });
  test("every line is one sentence", () => {
    for (const s of all) for (const x of steps(s)) expect(x.what.split(/[.!?](\s|$)/).filter((p) => p.trim()).length).toBe(1);
  });
});

describe("the one setting: Nudge · Off", () => {
  test("Nudge is the fleet's own — the nudge on, the fleet's act at the cap kept; Off writes the session's 0", () => {
    expect(planWrite(bau(), "off")).toEqual({ thresholdPct: 0 });
    expect(planWrite(bau({ atThreshold: "compact" }), "nudge")).toEqual({ nudge: true, atThreshold: null });
    expect(planWrite(bau({ thresholdPct: null, thresholdOff: "session", sessionPct: 0 }), "nudge")).toEqual({ thresholdPct: null, nudge: true, atThreshold: null });
  });
  test("planOf reads off where nothing comes, nudge otherwise — whatever Fleet does at the cap", () => {
    expect(planOf(bau())).toBe("nudge");
    expect(planOf(bau({ atThreshold: "compact" }))).toBe("nudge");
    expect(planOf(bau({ thresholdPct: null, thresholdOff: "session", sessionPct: 0 }))).toBe("off");
    expect(planOf(lane({ nudgeOn: false }))).toBe("off");
  });
});

describe("the texts typed into the session", () => {
  test("„later“ names the new threshold and, where Fleet acts, the cap above it", () => {
    expect(laterText(50, "succeed", false)).toBe("Noch nicht weitergeben: Arbeite bitte weiter, bis dein Kontext bei 50 % steht, und gib dann selbst weiter. Bei 55 % öffnet Fleet sonst selbst eine neue Session.");
    expect(laterText(45, "hint", true)).toBe("Noch nicht weitergeben: Arbeite bitte weiter, bis dein Kontext bei 45 % steht, und gib dann selbst weiter (mit deinem Bericht).");
  });
  test("„now“ names the doors the session hands over through", () => {
    expect(nowText(false)).toContain("POST /api/self/handover");
    expect(nowText(false)).toContain("POST /api/self/succeed");
    expect(nowText(true)).toContain("status handoff");
  });
});

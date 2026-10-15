// K16 E1 · Claude-Kontingent (server/usage.ts). Owner 15.10.: „[Zitat entfernt]“
// Das Ereignis unten ist die Zeile, die `claude -p --output-format stream-json` am 15.10. 10:40 auf 2.1.300 schrieb.
import { describe, expect, test } from "bun:test";
import { createClaudeQuotaReader, parseRateLimitEvent } from "./usage";

const EVENT = JSON.stringify({ type: "rate_limit_event", rate_limit_info: { status: "allowed", resetsAt: 1792060200,
  rateLimitType: "five_hour", overageStatus: "rejected", overageDisabledReason: "out_of_credits", isUsingOverage: false,
  unifiedWindows: { five_hour: { utilization: 0.12, resetsAt: 1792060200 }, seven_day: { utilization: 0.06, resetsAt: 1792605600 } } },
  uuid: "e31948c8-118e-4835-a4f3-852476614390", session_id: "55ac21e3-fac5-4d1a-a5ea-3b0f920c1e7a" });
const STREAM = [JSON.stringify({ type: "system", subtype: "init" }), EVENT, JSON.stringify({ type: "result", usage: {} })].join("\n");

describe("parseRateLimitEvent", () => {
  test("liest beide Fenster mit Reset-Zeit und Status aus dem gemessenen Strom", () => {
    expect(parseRateLimitEvent(STREAM)).toEqual({ fiveHour: { utilization: 0.12, resetsAt: 1792060200 },
      sevenDay: { utilization: 0.06, resetsAt: 1792605600 }, limitStatus: "allowed", overageStatus: "rejected" });
  });
  test("das letzte vollständige Ereignis gewinnt", () => {
    const later = EVENT.replace('"utilization":0.06', '"utilization":0.07');
    expect(parseRateLimitEvent(`${EVENT}\n${later}`)?.sevenDay.utilization).toBe(0.07);
  });
  test("leerer Strom, zerrissene Zeile und fehlendes Fenster ergeben null", () => {
    expect(parseRateLimitEvent("")).toBeNull();
    expect(parseRateLimitEvent(EVENT.slice(0, 120))).toBeNull();
    expect(parseRateLimitEvent(EVENT.replace('"seven_day"', '"seven_days"'))).toBeNull();
  });
  test("ein ungültiges Fenster verwirft das Ereignis, statt ein altes vorzutäuschen", () => {
    expect(parseRateLimitEvent(EVENT.replace('"utilization":0.12', '"utilization":-1'))).toBeNull();
    expect(parseRateLimitEvent(EVENT.replace('"resetsAt":1792605600', '"resetsAt":"bald"'))).toBeNull();
  });
});

describe("createClaudeQuotaReader", () => {
  const setup = (out: () => Promise<string>) => {
    let now = 1_000_000;
    const calls: string[] = [];
    const reader = createClaudeQuotaReader("claude", async (bin) => { calls.push(bin); return out(); }, () => now, 600_000);
    return { reader, calls, tick: (ms: number) => { now += ms; } };
  };

  test("misst beim ersten Abruf und nennt Fenster, Alter und Herkunft", async () => {
    const { reader, calls, tick } = setup(async () => STREAM);
    const first = await reader.get();
    expect(calls).toEqual(["claude"]);
    expect(first).toMatchObject({ status: "measured", fiveHour: { utilization: 0.12 }, sevenDay: { utilization: 0.06 },
      measuredAt: 1_000_000, ageMs: 0, reason: null });
    tick(60_000);
    expect((await reader.get()).ageMs).toBe(60_000);
  });
  test("liest höchstens einmal je maxAgeMs, danach neu", async () => {
    const { reader, calls, tick } = setup(async () => STREAM);
    await reader.get();
    tick(599_999);
    await reader.get();
    expect(calls.length).toBe(1);
    tick(1);
    await reader.get();
    expect(calls.length).toBe(2);
  });
  test("gleichzeitige Abrufe teilen sich ein Lesen", async () => {
    const { reader, calls } = setup(async () => STREAM);
    await Promise.all([reader.get(), reader.get(), reader.get()]);
    expect(calls.length).toBe(1);
  });
  test("ein Fehler nach einer Messung behält die Werte, nennt den Grund und wartet maxAgeMs bis zum nächsten Versuch", async () => {
    let fail = false;
    const { reader, calls, tick } = setup(async () => { if (fail) throw new Error("exit 1"); return STREAM; });
    await reader.get();
    fail = true;
    tick(600_000);
    const after = await reader.get();
    expect(after).toMatchObject({ status: "measured", sevenDay: { utilization: 0.06 }, reason: "read-failed: exit 1" });
    tick(1_000);
    await reader.get();
    expect(calls.length).toBe(2);
  });
  test("ohne Ereignis im Strom: error mit Grund, keine erfundenen Werte", async () => {
    const { reader } = setup(async () => '{"type":"result"}');
    expect(await reader.get()).toMatchObject({ status: "error", fiveHour: null, sevenDay: null, reason: "no-rate-limit-event" });
  });
  test("startet nichts, wenn diese Fleet kein claude startet (FLEET_CMD=true in der Suite)", async () => {
    let ran = 0;
    const reader = createClaudeQuotaReader(null, async () => { ran++; return STREAM; });
    expect(await reader.get()).toMatchObject({ status: "unknown", reason: "fleet-cmd-not-claude", fiveHour: null });
    expect(ran).toBe(0);
  });
});

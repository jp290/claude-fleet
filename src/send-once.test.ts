import { describe, expect, test } from "bun:test";
import { BOX_NAME_MS, boxSendName, dropBoxSendName, newSendName, SEND_GIVE_UP_MS, SEND_TRY_MS, sendTryMs, sendUntilAnswered, type SendClock } from "./send-once";

// a clock that runs only when something waits
function fakeClock(): SendClock & { t: number } {
  const c = {
    t: 0,
    timers: new Map<number, { at: number; fn: () => void }>(),
    n: 0,
    now() { return c.t; },
    async sleep(ms: number) { c.t += ms; },
    setTimeout(fn: () => void, ms: number) { c.timers.set(++c.n, { at: c.t + ms, fn }); return c.n; },
    clearTimeout(id: unknown) { c.timers.delete(id as number); },
  };
  return c;
}
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), size: () => m.size }; };

describe("one press on a bad line", () => {
  test("an answer ends it at once, and no retry is announced", async () => {
    let retries = 0;
    const r = await sendUntilAnswered(async () => new Response("{}"), { bytes: 10, stillWanted: () => true, onRetry: () => retries++, clock: fakeClock() });
    expect(r.kind).toBe("answer");
    expect(retries).toBe(0);
  });

  test("the line fails twice and comes back: it asks again by itself and gets the answer", async () => {
    let tries = 0, retries = 0;
    const r = await sendUntilAnswered(async () => { if (++tries < 3) throw new Error("line"); return new Response("{}"); },
      { bytes: 10, stillWanted: () => true, onRetry: () => retries++, clock: fakeClock() });
    expect(r.kind).toBe("answer");
    expect([tries, retries]).toEqual([3, 2]);
  });

  test("no answer at all: it ends as not known after the time he was told, not before", async () => {
    const clock = fakeClock();
    const r = await sendUntilAnswered(async () => { clock.t += 1000; throw new Error("line"); }, { bytes: 10, stillWanted: () => true, onRetry: () => {}, clock });
    expect(r.kind).toBe("not-known");
    expect(clock.t).toBeGreaterThanOrEqual(SEND_GIVE_UP_MS);
    expect(clock.t).toBeLessThan(SEND_GIVE_UP_MS + 10_000);
  });

  test("he changed the text: nothing more goes out for the old one", async () => {
    let tries = 0, wanted = true;
    const r = await sendUntilAnswered(async () => { tries++; wanted = false; throw new Error("line"); }, { bytes: 10, stillWanted: () => wanted, onRetry: () => {}, clock: fakeClock() });
    expect(r.kind).toBe("not-known");
    expect(tries).toBe(1);
  });

  test("a hanging read is cut after its try, a long text gets longer for its upload", async () => {
    expect(sendTryMs(10)).toBe(SEND_TRY_MS + 1000);
    expect(sendTryMs(200_000)).toBe(SEND_TRY_MS + 100_000);
    let saw: AbortSignal | undefined;
    const clock = fakeClock();
    const once = sendUntilAnswered((signal) => { saw = signal; return new Promise<Response>(() => {}); }, { bytes: 10, stillWanted: () => true, onRetry: () => {}, clock });
    void once;
    await Bun.sleep(0);
    expect(saw?.aborted).toBe(false);
    expect([...(clock as unknown as { timers: Map<number, { at: number }> }).timers.values()][0]!.at).toBe(SEND_TRY_MS + 1000);
  });
});

describe("the name of a press", () => {
  const storage = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
  };

  test("a press on the text still waiting in this box asks about the same message, also after a reload", () => {
    const store = storage();
    const first = boxSendName(3, "hallo", store, { store: storage(), untouched: true }, 1000);
    const second = boxSendName(3, "hallo", store, { store: storage(), untouched: true }, 2000);
    expect(first.again).toBe(false);
    expect(second).toEqual({ id: first.id, again: true });
  });

  test("after an answer or after typing the same words are a new message", () => {
    const store = storage();
    const first = boxSendName(3, "ok", store, { store: storage(), untouched: true }, 1000);
    dropBoxSendName(3, store);
    const second = boxSendName(3, "ok", store, { store: storage(), untouched: true }, 2000);
    expect(second.id).not.toBe(first.id);
    expect(second.again).toBe(false);
  });

  test("other words, another seat or a name too old: a new name", () => {
    const store = storage();
    const first = boxSendName(3, "hallo", store, { store: storage(), untouched: true }, 1000).id;
    expect(boxSendName(4, "hallo", store, { store: storage(), untouched: true }, 1000).id).not.toBe(first);
    expect(boxSendName(3, "hallo", store, { store: storage(), untouched: true }, 1000 + BOX_NAME_MS).id).not.toBe(first);
    const again = boxSendName(3, "hallo", store, { store: storage(), untouched: true }, 1000 + BOX_NAME_MS).id;
    expect(boxSendName(3, "hallo!", store, { store: storage(), untouched: true }, 1000 + BOX_NAME_MS).id).not.toBe(again);
  });

  test("a new tab: an untouched draft asks about the message the closed tab pressed", () => {
    const shared = storage();
    const closed = boxSendName(3, "hallo", storage(), { store: shared, untouched: true }, 1000);
    const next = boxSendName(3, "hallo", storage(), { store: shared, untouched: true }, 2000);
    expect(next).toEqual({ id: closed.id, again: true });
  });

  test("a second tab that typed the same words is a second message, and each tab keeps its own name", () => {
    const shared = storage(), tabA = storage(), tabB = storage();
    const a = boxSendName(3, "ok", tabA, { store: shared, untouched: true }, 1000);
    const b = boxSendName(3, "ok", tabB, { store: shared, untouched: false }, 2000);
    expect(b.id).not.toBe(a.id);
    expect(b.again).toBe(false);
    expect(boxSendName(3, "ok", tabA, { store: shared, untouched: false }, 3000)).toEqual({ id: a.id, again: true });
  });

  test("typing and an answer drop the name for every tab", () => {
    const shared = storage(), tab = storage();
    const first = boxSendName(3, "hallo", tab, { store: shared, untouched: true }, 1000);
    dropBoxSendName(3, tab, shared);
    expect(boxSendName(3, "hallo", storage(), { store: shared, untouched: true }, 2000).id).not.toBe(first.id);
  });

  test("other words in the draft: a new name, a new tab doesn't inherit it", () => {
    const shared = storage();
    const first = boxSendName(3, "hallo", storage(), { store: shared, untouched: true }, 1000);
    expect(boxSendName(3, "hallo!", storage(), { store: shared, untouched: true }, 2000).id).not.toBe(first.id);
  });

  test("a store that holds nothing gives a new name, never none", () => {
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); }, removeItem: () => { throw new Error("no"); } };
    expect(boxSendName(3, "hallo", broken, { store: storage(), untouched: true }).again).toBe(false);
    expect(newSendName()).toHaveLength(32);
    expect(() => dropBoxSendName(3, broken, broken)).not.toThrow();
  });
});

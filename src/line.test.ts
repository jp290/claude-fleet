import { describe, expect, test } from "bun:test";
import { Line, LINE_RED_MS, POLL_STALL_MS } from "./line";

// a clock the test turns by hand: the behaviour under test is what silence does over time
function world() {
  let now = 1_000;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let id = 0;
  const clock = {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => { timers.set(++id, { at: now + ms, fn }); return id as unknown as ReturnType<typeof setTimeout>; },
    clearTimeout: (t: ReturnType<typeof setTimeout>) => { timers.delete(t as unknown as number); },
  };
  const pass = (ms: number) => {
    now += ms;
    for (const [k, t] of [...timers]) if (t.at <= now && timers.delete(k)) t.fn();
  };
  return { line: new Line(clock), pass };
}

describe("the dot's half", () => {
  test("nothing heard yet is not connected", () => {
    expect(world().line.silent()).toBe(true);
  });

  test("a line that answers stays connected, however long it idles between reads", () => {
    const { line, pass } = world();
    const g = line.begin();
    g.life(); g.end();
    expect(line.silent()).toBe(false);
    pass(LINE_RED_MS * 5);
    expect(line.silent()).toBe(false);
  });

  test("asked and nothing back goes silent after the limit, and the first answer ends it", () => {
    const { line, pass } = world();
    const first = line.begin(); first.life(); first.end();
    const dead = line.begin();
    pass(LINE_RED_MS - 1);
    expect(line.silent()).toBe(false);
    pass(1);
    expect(line.silent()).toBe(true);
    const next = line.begin(); next.life(); next.end(); dead.end();
    expect(line.silent()).toBe(false);
  });

  test("reads that fail at once count as silence too, as with no network at all", () => {
    const { line, pass } = world();
    const first = line.begin(); first.life(); first.end();
    for (let i = 0; i < 5; i++) { line.begin().end(); pass(LINE_RED_MS / 4); }
    expect(line.silent()).toBe(true);
  });

  test("a read that crawls is alive: each byte moves the clock", () => {
    const { line, pass } = world();
    const g = line.begin();
    for (let i = 0; i < 10; i++) { pass(LINE_RED_MS - 1); g.life(); expect(line.silent()).toBe(false); }
    g.end();
  });
});

describe("the limit on a read", () => {
  test("no byte for the limit cuts the read and tells the panes", () => {
    const { line, pass } = world();
    let stalls = 0;
    line.onStall = () => { stalls++; };
    const g = line.begin();
    pass(POLL_STALL_MS - 1);
    expect(g.signal.aborted).toBe(false);
    pass(1);
    expect(g.signal.aborted).toBe(true);
    expect(stalls).toBe(1);
  });

  test("a read longer than the limit that keeps bringing bytes is never cut", () => {
    const { line, pass } = world();
    const g = line.begin();
    for (let i = 0; i < 6; i++) { pass(POLL_STALL_MS - 1); g.life(); }
    expect(g.signal.aborted).toBe(false);
    g.end();
  });

  test("a read that came home leaves no timer behind", () => {
    const { line, pass } = world();
    let stalls = 0;
    line.onStall = () => { stalls++; };
    const g = line.begin(); g.life(); g.end();
    pass(POLL_STALL_MS * 2);
    expect(stalls).toBe(0);
  });

  test("the body is read through to its JSON, and every chunk counts as life", async () => {
    const { line, pass } = world();
    const g = line.begin();
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        pass(POLL_STALL_MS - 1);
        c.enqueue(new TextEncoder().encode(pulled++ ? '"b"}' : '{"a":'));
        if (pulled === 2) c.close();
      },
    });
    expect(await g.json<{ a: string }>(new Response(stream))).toEqual({ a: "b" });
    expect(g.signal.aborted).toBe(false);
    g.end();
  });
});

describe("the weak line", () => {
  test("one slow poll changes nothing, two do, and a quick one ends it", () => {
    const { line } = world();
    let flips = 0;
    line.onWeak = () => { flips++; };
    line.read(2_500);
    expect(line.weak).toBe(false);
    line.read(300);
    line.read(2_500);
    expect(line.weak).toBe(false);
    line.read(2_500);
    expect(line.weak).toBe(true);
    line.read(2_500);
    expect(line.weak).toBe(true);
    line.read(300);
    expect(line.weak).toBe(false);
    expect(flips).toBe(2);
  });
});

describe("coming back from hidden", () => {
  test("a read from before the page left is cut and its silence forgotten; one just started stays", () => {
    const { line, pass } = world();
    let stalls = 0;
    line.onStall = () => { stalls++; };
    const first = line.begin(); first.life(); first.end();
    const old = line.begin();
    pass(LINE_RED_MS);
    expect(line.silent()).toBe(true);
    const fresh = line.begin();
    line.back();
    expect(old.signal.aborted).toBe(true);
    expect(fresh.signal.aborted).toBe(false);
    expect(stalls).toBe(1);
    expect(line.silent()).toBe(false);
    old.end(); fresh.end();
  });
});

describe("back on a line nothing has confirmed", () => {
  test("not green until a read has answered, then green; and red when none does", () => {
    const { line, pass } = world();
    const first = line.begin();
    first.life();
    first.end();
    expect(line.unconfirmed()).toBe(false);
    line.back();
    expect(line.unconfirmed()).toBe(true);
    expect(line.silent()).toBe(false);
    const read = line.begin();
    pass(LINE_RED_MS);
    expect(line.silent()).toBe(true);
    read.life();
    expect(line.unconfirmed()).toBe(false);
    expect(line.silent()).toBe(false);
    read.end();
  });

  test("back from hidden, the first answer says so at once, and only the first", () => {
    const { line } = world();
    let told = 0;
    line.onConfirmed = () => { told++; };
    line.back();
    expect(line.unconfirmed()).toBe(true);
    const guard = line.begin();
    guard.life();
    expect(line.unconfirmed()).toBe(false);
    expect(told).toBe(1);
    guard.life();
    guard.end();
    expect(told).toBe(1);
  });
});

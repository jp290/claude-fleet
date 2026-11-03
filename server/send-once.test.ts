import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { keepSendNamesIn, repeatOf, SEND_REPEAT_HEADER, sendOnce, validClientId } from "./send-once";
import { json } from "./json";

const id = () => `probe-${crypto.randomUUID()}`;
const STOPPED = () => json({ error: "send outcome uncertain", receipt: { delivery: "uncertain" } }, 409);
// what the door does: a name already here answers first, a new one is typed
const send = async (slot: number, name: string, run: () => Promise<Response>, now?: number, text = "hallo"): Promise<Response> =>
  await (repeatOf(slot, name, text, STOPPED) ?? sendOnce(slot, name, text, run, now));

describe("one send, however many times it is asked for", () => {
  test("the answer got lost and the page asks again: nothing is typed twice, and the second answer says it is a repeat", async () => {
    let typed = 0;
    const run = async () => { typed++; return json({ ok: true, receipt: { sendId: "a" } }); };
    const name = id();
    const first = await send(1, name, run);
    const second = await send(1, name, run);
    expect(typed).toBe(1);
    expect(first.headers.get(SEND_REPEAT_HEADER)).toBeNull();
    expect(second.headers.get(SEND_REPEAT_HEADER)).toBe("1");
    expect(await second.json()).toEqual({ ok: true, receipt: { sendId: "a" } });
  });

  test("asked again while the first is still typing: both wait for the one send", async () => {
    let typed = 0, finish = () => {};
    const run = () => { typed++; return new Promise<Response>((ok) => { finish = () => ok(json({ ok: true })); }); };
    const name = id();
    const both = [send(1, name, run), send(1, name, run)];
    finish();
    const answers = await Promise.all(both);
    expect(typed).toBe(1);
    expect(answers.map((a) => a.status)).toEqual([200, 200]);
  });

  test("refused means nothing was typed, so the same name may try again", async () => {
    let tries = 0;
    const run = async () => (++tries === 1 ? json({ error: "busy", receipt: { delivery: "refused" } }, 409) : json({ ok: true }));
    const name = id();
    expect((await send(1, name, run)).status).toBe(409);
    await Bun.sleep(0);
    expect((await send(1, name, run)).status).toBe(200);
    expect(tries).toBe(2);
  });

  test("an uncertain send may have typed: asking again answers the same and types nothing", async () => {
    let tries = 0;
    const run = async () => { tries++; return json({ error: "send outcome uncertain", receipt: { delivery: "uncertain" } }, 409); };
    const name = id();
    await send(1, name, run);
    await Bun.sleep(0);
    expect((await send(1, name, run)).status).toBe(409);
    expect(tries).toBe(1);
  });

  test("the same name in another seat is another message", async () => {
    let typed = 0;
    const run = async () => { typed++; return json({ ok: true }); };
    const name = id();
    await send(1, name, run);
    await send(2, name, run);
    expect(typed).toBe(2);
  });

  test("after its time a name is forgotten", async () => {
    let typed = 0;
    const run = async () => { typed++; return json({ ok: true }); };
    const name = id(), t0 = Date.now();
    await send(1, name, run, t0);
    expect(typed).toBe(1);
    await sendOnce(1, id(), "other", run, t0 + 25 * 60 * 60_000); // the next send clears what has run out
    expect(repeatOf(1, name, "hallo", STOPPED)).toBeNull();
  });

  test("the same name with other words types nothing and says so", async () => {
    let typed = 0;
    const run = async () => { typed++; return json({ ok: true }); };
    const name = id();
    await send(1, name, run);
    const other = await send(1, name, run, undefined, "ganz anders");
    expect(other.status).toBe(409);
    expect(typed).toBe(1);
  });

  test("a name is short and plain", () => {
    expect(validClientId("abcdefgh")).toBe(true);
    expect(validClientId("short")).toBe(false);
    expect(validClientId("x".repeat(65))).toBe(false);
    expect(validClientId(7)).toBe(false);
  });
});

describe("the names survive the server's restart", () => {
  const stateFile = () => join(mkdtempSync(join(tmpdir(), "send-names-")), "send-names.jsonl");

  test("typed, the answer lost, the server restarted: the page asks again, nothing is typed, and the answer is the first one", async () => {
    const file = stateFile();
    keepSendNamesIn(file);
    let typed = 0;
    const run = async () => { typed++; return json({ ok: true, receipt: { sendId: "a" } }); };
    const name = id();
    await send(1, name, run);
    await Bun.sleep(0);
    keepSendNamesIn(file);
    const again = await send(1, name, run);
    expect(typed).toBe(1);
    expect(again.status).toBe(200);
    expect(again.headers.get(SEND_REPEAT_HEADER)).toBe("1");
    expect(await again.json()).toEqual({ ok: true, receipt: { sendId: "a" } });
  });

  test("the server stopped in the middle of typing: the name answers uncertain, never a second typing, and stays that way", async () => {
    const file = stateFile();
    keepSendNamesIn(file);
    let typed = 0;
    const run = () => { typed++; return new Promise<Response>(() => {}); }; // it never finishes: the server stops here
    const name = id();
    void send(1, name, run);
    keepSendNamesIn(file);
    let stopped = 0;
    const first = await repeatOf(1, name, "hallo", () => { stopped++; return STOPPED(); })!;
    const second = await repeatOf(1, name, "hallo", () => { stopped++; return STOPPED(); })!;
    expect(typed).toBe(1);
    expect(stopped).toBe(1);
    expect(first.status).toBe(409);
    expect(second.status).toBe(409);
    expect(((await first.json()) as { receipt: { delivery: string } }).receipt.delivery).toBe("uncertain");
  });

  test("refused stays refused across a restart: nothing was typed, so the same name may try", async () => {
    const file = stateFile();
    keepSendNamesIn(file);
    const name = id();
    await send(1, name, async () => json({ error: "busy", receipt: { delivery: "refused" } }, 409));
    await Bun.sleep(0);
    keepSendNamesIn(file);
    expect(repeatOf(1, name, "hallo", STOPPED)).toBeNull();
  });

  test("the file holds no text and only its owner reads it", async () => {
    const file = stateFile();
    keepSendNamesIn(file);
    await send(1, id(), async () => json({ ok: true }), undefined, "das geheime wort");
    expect(readFileSync(file, "utf8")).not.toContain("geheime");
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  test("a file created by the first send, with no compaction yet, is its owner's alone", async () => {
    const file = stateFile();
    keepSendNamesIn(file);
    expect(existsSync(file)).toBe(false);
    // a server started with an open umask: only the mode the append asks for keeps it private
    const umask = process.umask(0o022);
    try {
      await send(1, id(), async () => json({ ok: true }));
    } finally { process.umask(umask); }
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  test("the file shrinks while the server runs, and the newest name still answers after a restart", async () => {
    const file = stateFile();
    keepSendNamesIn(file);
    const lines = (): number => readFileSync(file, "utf8").split("\n").length - 1;
    let last = "", most = 0;
    for (let i = 0; i < 5_000; i++) {
      last = id();
      await send(1, last, async () => json({ ok: true }));
      if (i % 250 === 0) { await Bun.sleep(0); most = Math.max(most, lines()); }
    }
    await Bun.sleep(5);
    expect(lines()).toBeLessThan(8_100);
    expect(most).toBeLessThan(8_100);
    keepSendNamesIn(file);
    expect(repeatOf(1, last, "hallo", STOPPED)).not.toBeNull();
  }, 30_000);

  test("a line cut by the stop reads as nothing, and what has run out is gone after the restart", async () => {
    const file = stateFile();
    keepSendNamesIn(file);
    const name = id(), old = Date.now() - 25 * 60 * 60_000;
    await send(1, name, async () => json({ ok: true }), old);
    await Bun.sleep(0);
    const { appendFileSync } = await import("node:fs");
    appendFileSync(file, '{"k":"1:cut');
    keepSendNamesIn(file);
    expect(repeatOf(1, name, "hallo", STOPPED)).toBeNull();
  });
});

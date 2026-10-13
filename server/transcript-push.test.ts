// Neuaufbau K10 S2 · Tempo. Owner 13.10.: „[Zitat entfernt]“
// . Der Chat wartet nicht mehr bis zu einer Sekunde auf seinen
// nächsten Abruf: der Server sagt dem Pane-Socket des Owners, sobald das Transkript eine Zeile mehr hat.
import { describe, expect, test } from "bun:test";
import { createTranscriptPush, transcriptFrame, type PushSocket } from "./transcript-push";

const sock = (data: PushSocket["data"]) => {
  const got: string[] = [];
  return { data, got, send: (m: string) => { got.push(m); } };
};

describe("Push: der Chat hört, wann sein Transkript gewachsen ist", () => {
  test("jeder bereite Owner-Socket hört die neue Zeilenzahl einmal; ein Gast und ein noch nicht geseedeter Socket nichts", async () => {
    let n = 4;
    const owner = sock({ ready: true }), second = sock({ ready: true }), guest = sock({ ready: true, share: "s1" }), seeding = sock({ ready: false });
    const push = createTranscriptPush({ slots: () => [{ id: 1, clients: [owner, second, guest, seeding] }], count: async () => n });
    await push.tick();
    await push.tick(); // nothing new: nothing sent
    n = 5;
    await push.tick();
    expect(owner.got).toEqual([transcriptFrame(4), transcriptFrame(5)]);
    expect(second.got).toEqual(owner.got);
    expect(guest.got).toEqual([]);
    expect(seeding.got).toEqual([]);
    seeding.data.ready = true; // seeded now: it hears where the file stands
    await push.tick();
    expect(seeding.got).toEqual([transcriptFrame(5)]);
    expect(JSON.parse(transcriptFrame(5))).toEqual({ t: "transcript", lines: 5 });
  });
  test("eine Datei, die schrumpft (neue Session-Datei), wird auch gemeldet", async () => {
    let n = 40;
    const owner = sock({ ready: true });
    const push = createTranscriptPush({ slots: () => [{ id: 1, clients: [owner] }], count: async () => n });
    await push.tick();
    n = 2;
    await push.tick();
    expect(owner.got).toEqual([transcriptFrame(40), transcriptFrame(2)]);
  });
  test("ohne Transkript, ohne Owner oder bei einem Lesefehler: nichts gesendet, der nächste Takt läuft wieder", async () => {
    const owner = sock({ ready: true });
    let fail = true, asked = 0;
    const push = createTranscriptPush({
      slots: () => [{ id: 1, clients: [owner] }, { id: 2, clients: [] }, { id: 3, clients: [sock({ ready: true })] }],
      count: async (id) => { asked++; if (id === 3) return null; if (fail) throw new Error("ENOENT"); return 7; },
    });
    await push.tick();
    expect(owner.got).toEqual([]);
    expect(asked).toBe(2); // slot 2 has no owner socket: not even counted
    fail = false;
    await push.tick();
    expect(owner.got).toEqual([transcriptFrame(7)]);
  });
  test("ein Takt, der noch liest, wird nicht verdoppelt", async () => {
    let release = () => {};
    let counts = 0;
    const owner = sock({ ready: true });
    const push = createTranscriptPush({
      slots: () => [{ id: 1, clients: [owner] }],
      count: () => { counts++; return new Promise<number>((ok) => { release = () => ok(3); }); },
    });
    const first = push.tick();
    await push.tick();
    release();
    await first;
    expect(counts).toBe(1);
    expect(owner.got).toEqual([transcriptFrame(3)]);
  });
});

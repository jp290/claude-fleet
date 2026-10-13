// Neuaufbau K10 S1 · Live-Zustand. Owner 13.10.: „[Zitat entfernt]“
//  Statuszeile in seinen Worten: arbeitet, denkt, Hooks laufen, wartet auf dich,
// unterbrochen, bereit. Die Rahmen und Transkript-Zeilen sind aufgezeichnet (live-state.fixtures.json:
// Claude Code 2.1.296, befunde/08 Methode), nicht nachgebaut.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { combine, createLiveReader, emptyTail, foldLine, readFrame, readTranscript, viewFolder, type TailState } from "./live-state";
import fixtures from "./live-state.fixtures.json";

const F = fixtures.frames as Record<string, string>;
const TX = fixtures.transcript as string[];
const fold = (lines: readonly string[], from: TailState = emptyTail()): TailState =>
  lines.reduce((t, l) => foldLine(t, l, t.lines + 1), from);
const lineOf = (pred: (d: Record<string, unknown>) => boolean): number => {
  const i = TX.findIndex((l) => pred(JSON.parse(l) as Record<string, unknown>));
  if (i < 0) throw new Error("fixture line not found");
  return i + 1;
};
const prompt = (start: string) => lineOf((d) => d.type === "user"
  && typeof (d.message as { content?: unknown })?.content === "string"
  && ((d.message as { content: string }).content).startsWith(start));
const queueOp = (op: string, content?: string) => lineOf((d) => d.type === "queue-operation" && d.operation === op
  && (content === undefined || d.content === content));

describe("Rahmen: was das Terminal gerade zeigt", () => {
  test("Spinner am Turn-Anfang, noch ohne Klammer: arbeitet", () => {
    expect(readFrame(F.spinner_start!)).toMatchObject({ shape: "spinner", detail: null, composer: "" });
  });
  test("„(1s · thinking)“: denkt", () => {
    expect(readFrame(F.spinner_thinking!)).toMatchObject({ shape: "spinner", detail: "thinking" });
  });
  test("„thought for 2s“ während eines Werkzeugs ist vorbei gedacht, nicht denkt", () => {
    expect(readFrame(F.tool_thought!)).toMatchObject({ shape: "spinner", detail: null });
  });
  test("„running Stop hooks… 3/4“: Hooks laufen", () => {
    expect(readFrame(F.hooks!)).toMatchObject({ shape: "spinner", detail: "hooks" });
  });
  test("Text streamt: kein Spinner über der Eingabe, der Rahmen allein kann es nicht benennen", () => {
    expect(readFrame(F.streaming!).shape).toBe("text");
  });
  test("Abschlusszeile „Worked for 1s · done“: bereit, leeres Eingabefeld", () => {
    expect(readFrame(F.done!)).toMatchObject({ shape: "done", composer: "" });
  });
  test("„Interrupted · What should Claude do instead?“ direkt über der Eingabe: unterbrochen", () => {
    expect(readFrame(F.interrupted!).shape).toBe("interrupted");
  });
  test("AskUserQuestion-Dialog: wartet auf dich", () => {
    expect(readFrame(F.ask!)).toMatchObject({ shape: "dialog", composer: null });
  });
  test("eine gequeuete Nachricht steht über der Eingabe; der gedimmte Platzhalter ist kein Inhalt", () => {
    expect(readFrame(F.queued!).composer).toBe("");
  });
  test("↑ hat die gequeuete Nachricht zum Bearbeiten ins Eingabefeld geholt", () => {
    expect(readFrame(F.popall!).composer).toBe("FQ antworte nur OK-FQ");
  });
  test("Esc vor der ersten Ausgabe: Abschlusszeile des Turns davor, die Nachricht steht wieder im Eingabefeld", () => {
    const r = readFrame(F.early_esc!);
    expect(r.shape).toBe("done");
    expect(r.composer).toBe("Schreibe einen Aufsatz von 900 Woertern ueber Marienkaefer.");
  });
  test("eine Pane ohne Claude-Eingabe (Shell, Stand-in) ist unbekannt, nicht bereit", () => {
    expect(readFrame("$ \n$ ls\nREADME.md\n").shape).toBe("unknown");
  });
});

describe("Transkript: Claude Codes Warteschlange und offene Anfrage", () => {
  const fq = "FQ antworte nur OK-FQ";
  test("Enter mitten im Turn reiht ein; ↑ (popAll) holt sie heraus, nichts wartet mehr", () => {
    const enq = queueOp("enqueue", fq), pop = queueOp("popAll");
    expect(fold(TX.slice(0, enq)).open.map((q) => q.text)).toEqual([fq]);
    expect(fold(TX.slice(0, pop)).open).toEqual([]);
  });
  test("bearbeitet und neu eingereiht wartet nur der neue Text, und dequeue nimmt ihn", () => {
    const re = queueOp("enqueue", `${fq} NEU`);
    expect(fold(TX.slice(0, re)).open.map((q) => q.text)).toEqual([`${fq} NEU`]);
    expect(fold(TX.slice(0, re + 1)).open).toEqual([]);
  });
  test("Esc vor der Ausgabe: die nächste Nachricht ist Schwester der zurückgeholten, die zurückgeholte ist zurückgenommen", () => {
    const taken = TX.findIndex((l, i) => i + 1 > queueOp("dequeue") && l.includes("Marienkaefer")) + 1;
    const next = prompt("Antworte nur NAECHSTE.");
    expect(fold(TX.slice(0, next - 1)).withdrawn).toEqual([]);
    expect(fold(TX.slice(0, next)).withdrawn).toEqual([taken]);
  });
  test("zwei gequeuete Nachrichten, die zusammen abgeholt werden, hängen aneinander — keine ist zurückgenommen", () => {
    expect(fold(TX.slice(0, prompt("Lies mit dem Read-Tool"))).withdrawn).toEqual([]);
  });
  test("offene Anfrage: ab dem Prompt, über Werkzeug-Ergebnisse, bis end_turn; ein Esc-Marker schließt sie", () => {
    const p = prompt("Antworte nur NAECHSTE.");
    expect(fold(TX.slice(0, p)).request).toBe(true);
    const end = TX.findIndex((l, i) => i + 1 > p && l.includes('"stop_reason":"end_turn"')) + 1;
    expect(fold(TX.slice(0, end)).request).toBe(false);
    expect(fold(TX).request).toBe(false); // the last essay was interrupted: its marker closed it
  });
});

describe("Zustand: Rahmen und Transkript zusammen", () => {
  const open = fold(TX.slice(0, prompt("Antworte nur NAECHSTE."))), closed = fold(TX);
  test("Text streamt bei offener Anfrage: arbeitet; ohne offene Anfrage: bereit", () => {
    expect(combine(readFrame(F.streaming!), open, 1).turn).toBe("working");
    expect(combine(readFrame(F.streaming!), closed, 1).turn).toBe("ready");
  });
  test("die Abschlusszeile schlägt eine offen gebliebene, per Esc zurückgeholte Anfrage", () => {
    expect(combine(readFrame(F.early_esc!), open, 1).turn).toBe("ready");
  });
  test("denkt und Hooks laufen sind arbeitet mit Detail; Dialog, unterbrochen, unbekannt ohne Detail", () => {
    expect(combine(readFrame(F.spinner_thinking!), open, 1)).toMatchObject({ turn: "working", detail: "thinking" });
    expect(combine(readFrame(F.hooks!), closed, 1)).toMatchObject({ turn: "working", detail: "hooks" });
    expect(combine(readFrame(F.ask!), open, 1)).toMatchObject({ turn: "asking", detail: null });
    expect(combine(readFrame(F.interrupted!), closed, 1)).toMatchObject({ turn: "interrupted", detail: null });
    expect(combine(readFrame(""), closed, 1)).toMatchObject({ turn: "unknown", detail: null });
  });
});

describe("Leser: nur was dazukam, und ein Rahmen nur, wenn die Pane gemalt hat", () => {
  const dir = mkdtempSync(join(tmpdir(), "live-state-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  test("in Stücken angehängt, mitten in einer Zeile abgerissen: dieselbe Zählung und derselbe Zustand wie am Stück", async () => {
    const file = join(dir, "t.jsonl");
    writeFileSync(file, "");
    let clock = 0, mark = 0, captures = 0;
    const reader = createLiveReader({
      capture: async () => { captures++; return F.streaming!; },
      transcript: () => file, paintMark: () => mark, identity: () => "occupant-1",
    }, () => clock);
    const text = TX.map((l) => `${l}\n`).join("");
    const cuts = [0, 1000, 1001, 9000, 30_000, text.length];
    for (let i = 1; i < cuts.length; i++) {
      appendFileSync(file, text.slice(cuts[i - 1], cuts[i]));
      clock += 250; mark++;
      await reader.read(1);
    }
    const whole = fold(TX);
    const s = await reader.read(1);
    expect(s.withdrawn).toEqual(whole.withdrawn);
    expect(s.queued).toEqual([]);
    expect(s.turn).toBe("ready");
    const before = captures;
    clock += 250;
    await reader.read(1); // painted nothing since the last frame: no capture
    expect(captures).toBe(before);
    mark++;
    await reader.read(1); // painted: a new frame
    expect(captures).toBe(before + 1);
    mark++; clock += 50;
    await reader.read(1); // painted again, but 50 ms after that frame: no capture
    expect(captures).toBe(before + 1);
    clock += 150;
    await reader.read(1);
    expect(captures).toBe(before + 2);
  });
  test("ein neuer Occupant beginnt von vorn", async () => {
    const file = join(dir, "u.jsonl");
    writeFileSync(file, `${TX.slice(0, prompt("Antworte nur NAECHSTE.")).join("\n")}\n`);
    let who = "a";
    const reader = createLiveReader({ capture: async () => null, transcript: () => file, paintMark: () => 0, identity: () => who });
    expect((await reader.read(2)).withdrawn.length).toBe(1);
    writeFileSync(file, `${TX[0]}\n`);
    who = "b";
    expect(await reader.read(2)).toMatchObject({ withdrawn: [], turn: "unknown" });
  });
});

// Neuaufbau K10 S2 · Tempo. Owner 13.10.: „[Zitat entfernt]“
// . Der Transkript-Abruf liest vom selben Sitz wie der Live-Zustand:
// nur was dazukam, dann die Bytes der Zeilen ab `after`. Er muss dieselben Zeilen liefern wie die ganze Datei.
describe("Transkript-Abruf: dieselben Zeilen wie die ganze Datei, gelesen wird nur, was dazukam", () => {
  const dir = mkdtempSync(join(tmpdir(), "live-tail-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  // what the route read before S2: the whole file, split, blank lines dropped
  const whole = (bytes: Buffer, after: number) => {
    const all = bytes.toString("utf8").split("\n").filter((l) => l.trim() !== "");
    return { lines: all.slice(after), total: all.length };
  };
  const reader = (file: string) => createLiveReader({ capture: async () => null, transcript: () => file, paintMark: () => 0, identity: () => "o" });

  test("in Stücken angehängt, auch mitten in einem Umlaut abgerissen: je Stand dieselben Zeilen und dieselbe Zahl", async () => {
    const file = join(dir, "a.jsonl");
    writeFileSync(file, "");
    const r = reader(file);
    const bytes = Buffer.from(`${TX.join("\n")}\n\n  \n`, "utf8");
    const umlaut = bytes.indexOf(Buffer.from("ü", "utf8"));
    expect(umlaut).toBeGreaterThan(0);
    const cuts = [0, 777, umlaut + 1, umlaut + 2, 9000, 9001, 20_000, bytes.length - 3, bytes.length];
    for (let i = 1; i < cuts.length; i++) {
      appendFileSync(file, bytes.subarray(cuts[i - 1], cuts[i]));
      const sofar = bytes.subarray(0, cuts[i]);
      const total = whole(sofar, 0).total;
      for (const after of [0, 1, Math.floor(total / 2), total - 1, total, total + 3]) {
        const got = await r.lines(1, file, after);
        expect({ lines: got.lines, total: got.total }).toEqual(whole(sofar, after));
      }
    }
  });
  test("vollständige Zeilen zählen; die Zeile, die Claude Code noch schreibt, erst, wenn sie fertig ist", async () => {
    const file = join(dir, "b.jsonl");
    writeFileSync(file, `${TX[0]}\n${TX[1]}\n${TX[2]!.slice(0, 40)}`);
    const r = reader(file);
    expect(await r.count(1)).toBe(2);
    expect((await r.lines(1, file, 0)).total).toBe(3); // the route hands the torn line out last, as before
    appendFileSync(file, `${TX[2]!.slice(40)}\n`);
    expect(await r.count(1)).toBe(3);
  });
  test("Abruf, Live-Zustand und Zählung gleichzeitig auf einem Sitz lesen jede Zeile einmal", async () => {
    const file = join(dir, "c.jsonl");
    writeFileSync(file, "");
    const r = reader(file);
    for (let k = 0; k < TX.length; k += 7) {
      appendFileSync(file, TX.slice(k, k + 7).map((l) => `${l}\n`).join(""));
      const [a, , n, b] = await Promise.all([r.lines(1, file, 0), r.read(1), r.count(1), r.lines(1, file, k)]);
      const bytes = Buffer.from(TX.slice(0, k + 7).map((l) => `${l}\n`).join(""));
      expect(a.lines).toEqual(whole(bytes, 0).lines);
      expect(b.lines).toEqual(whole(bytes, k).lines);
      expect(n).toBe(whole(bytes, 0).total);
    }
    expect((await r.read(1)).withdrawn).toEqual(fold(TX).withdrawn);
  });
  test("eine kürzer gewordene Datei wird von vorn gelesen", async () => {
    const file = join(dir, "d.jsonl");
    writeFileSync(file, TX.map((l) => `${l}\n`).join(""));
    const r = reader(file);
    expect((await r.lines(1, file, 0)).total).toBe(TX.length);
    writeFileSync(file, `${TX[5]}\n`);
    expect(await r.lines(1, file, 0)).toMatchObject({ lines: [TX[5]], total: 1 });
  });
  test("eine vergangene Session liest dieselben Zeilen einmal am Stück; eine fehlende Datei wirft wie zuvor", async () => {
    const file = join(dir, "e.jsonl");
    writeFileSync(file, TX.map((l) => `${l}\n`).join(""));
    expect(await readTranscript(file, 10)).toEqual(await reader(file).lines(1, file, 10));
    await expect(readTranscript(join(dir, "fehlt.jsonl"), 0)).rejects.toThrow();
  });
  test("was die ganze Datei über die Zeilen ab `after` sagt: Rückfrage samt Eingabe, Antwort, Warteschlange, neuestes Modell", async () => {
    const ask = TX.map((l) => JSON.parse(l) as { type?: string; message?: { content?: { type?: string; name?: string; id?: string; input?: unknown }[] } })
      .flatMap((d) => (d.type === "assistant" ? d.message?.content ?? [] : []).filter((b) => b.type === "tool_use" && b.name === "AskUserQuestion"));
    expect(ask.length).toBe(2);
    const ids = ask.map((b) => String(b.id));
    const extra = [
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: String(ask[1]!.id), content: "Meer" }] } },
      { type: "attachment", attachment: { type: "queued_command", commandMode: "prompt", source_uuid: "q-1", prompt: "danach" } },
      { type: "assistant", effort: "low", message: { model: "claude-opus-5-5", content: [{ type: "text", text: "x" }] } },
      { type: "assistant", message: { model: "<synthetic>", content: [{ type: "text", text: "API Error" }] } },
    ].map((o) => JSON.stringify(o));
    const file = join(dir, "f.jsonl");
    writeFileSync(file, [...TX, ...extra].map((l) => `${l}\n`).join(""));
    const { facts, lines } = await reader(file).lines(1, file, TX.length + 3);
    expect(lines).toEqual([extra[3]]);
    expect([...facts.askCalls.keys()]).toEqual(ids);
    expect(facts.askCalls.get(ids[0]!)).toEqual(ask[0]!.input);
    // the first one Esc closed in the recording, which Claude Code answers with a tool_result too
    expect(TX.some((l) => l.includes('"tool_result"') && l.includes(ids[0]!))).toBe(true);
    expect([...facts.askAnswered]).toEqual(ids);
    expect([...facts.queued]).toEqual(["q-1"]);
    expect({ model: facts.model, effort: facts.effort }).toEqual({ model: "claude-opus-5-5", effort: "low" });
  });
  test("eine Rückfrage aus einem Subagenten gehört nicht zu dieser Unterhaltung", () => {
    const v = viewFolder();
    v.add(JSON.stringify({ type: "assistant", isSidechain: true, message: { content: [{ type: "tool_use", name: "AskUserQuestion", id: "side", input: {} }] } }));
    expect(v.facts().askCalls.size).toBe(0);
  });
});

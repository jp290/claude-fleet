// Neuaufbau K10 S1 · Live-Zustand. Owner 13.10.: „[Zitat entfernt]“
//  Statuszeile in seinen Worten: arbeitet, denkt, Hooks laufen, wartet auf dich,
// unterbrochen, bereit. Die Rahmen und Transkript-Zeilen sind aufgezeichnet (live-state.fixtures.json:
// Claude Code 2.1.296, befunde/08 Methode), nicht nachgebaut.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { combine, createLiveReader, emptyTail, foldLine, readFrame, sessionQueue, type TailState } from "./live-state";
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
  test("sessionQueue liest dieselbe Warteschlange wie der Leser", () => {
    for (const n of [queueOp("enqueue", fq), queueOp("popAll"), queueOp("enqueue", `${fq} NEU`), TX.length])
      expect(sessionQueue(TX.slice(0, n))).toEqual(fold(TX.slice(0, n)).open.map((q) => ({ text: q.text, at: q.at })));
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

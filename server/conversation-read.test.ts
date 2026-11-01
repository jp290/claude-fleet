// WAS EIN PI-SITZ GEÄNDERT HAT (Owner 28.10.: „[Zitat entfernt]“
// ): ein pi-`edit`/`write` trägt die Änderung vollständig in seinen
// Argumenten. Der Leser gab bisher nur abgeschnittenes JSON weiter (`edit {"path":"src/…","oldText":"…`), und
// mehr konnte das Board nicht zeigen. Hier steht, dass der Block Pfad und alt/neu (bzw. Inhalt) STRUKTURELL
// trägt — und dass jeder andere Aufruf die Zeile von heute behält.
//
// Gemessenes Format (pi 1.0.2, dist/core/tools/edit.d.ts + write.d.ts): `edit` = {path, edits:[{oldText,
// newText}]}, `write` = {path, content}. Die flache Form {path, oldText, newText} liest der Leser zusätzlich,
// weil sie im Auftrag so genannt ist und ältere Aufrufe sie tragen können. Der Leser ist rein (kein
// Server, keine Datei): die Zeilen kommen hier synthetisch herein.
import { describe, expect, test } from "bun:test";
import { otherSender, splitDeliveryHeader } from "../src/pendingsend";
import { FILE_LINES, LINE_MAX, PATH_MAX, SIDE_MAX, readPiSession, type TBlock } from "./conversation-read";

const TS = "2026-10-28T10:00:00.000Z";
const kopf = JSON.stringify({ type: "session", id: "s0", timestamp: TS });
const frage = JSON.stringify({ type: "message", id: "u1", parentId: "s0", timestamp: TS,
  message: { role: "user", content: [{ type: "text", text: "änder was" }] } });
const antwort = (name: string, args: unknown, id = "a1") => JSON.stringify({ type: "message", id, parentId: "u1",
  timestamp: TS, message: { role: "assistant", timestamp: 1761645600000, provider: "anthropic", model: "m",
    content: [{ type: "toolCall", id: `c-${id}`, name, arguments: args }] } });
const block = (name: string, args: unknown): TBlock =>
  readPiSession([kopf, frage, antwort(name, args)]).entries[1]!.blocks[0]!;

describe("ein pi-Werkzeugaufruf, der eine Datei ändert, trägt die Änderung strukturell", () => {
  test("edit: Pfad, alter und neuer Text als Zeilen", () => {
    const b = block("edit", { path: "src/a.ts", oldText: "alt 1\nalt 2", newText: "neu 1" });
    expect(b.t).toBe("tool");
    expect(b.file).toEqual({ path: "src/a.ts", before: ["alt 1", "alt 2"], after: ["neu 1"], cut: false });
  });

  test("edit in der gemessenen Form edits[]: jede Ersetzung, in einer Reihenfolge", () => {
    const b = block("edit", { path: "src/b.ts", edits: [
      { oldText: "eins", newText: "EINS" }, { oldText: "zwei", newText: "ZWEI" }] });
    expect(b.file).toEqual({ path: "src/b.ts", before: ["eins", "zwei"], after: ["EINS", "ZWEI"], cut: false });
  });

  test("write: Pfad und Inhalt, ohne alten Text", () => {
    const b = block("write", { path: "docs/neu.md", content: "# Titel\n\nZeile\n" });
    expect(b.file).toEqual({ path: "docs/neu.md", after: ["# Titel", "", "Zeile"], cut: false });
  });

  test("ein gekappter write sagt es und behält höchstens FILE_LINES Zeilen", () => {
    const b = block("write", { path: "gross.txt", content: Array.from({ length: 200 }, (_, i) => `z${i}`).join("\n") });
    expect(b.file!.after.length).toBe(FILE_LINES);
    expect(b.file!.cut).toBe(true);
  });

  test("eine überlange Zeile wird gekappt, nicht mitgerissen", () => {
    const b = block("edit", { path: "min.txt", oldText: "x".repeat(LINE_MAX + 50), newText: "kurz" });
    expect(b.file?.before?.[0]).toBe("x".repeat(LINE_MAX));
    expect(b.file?.cut).toBe(true);
  });

  test("die Seitengrenze SIDE_MAX hält den Block klein — eine Seite bleibt unter dem Budget", () => {
    const zeile = "y".repeat(LINE_MAX);
    const b = block("write", { path: "gross.txt", content: Array.from({ length: 10 }, () => zeile).join("\n") });
    expect(b.file!.after.length).toBe(Math.floor(SIDE_MAX / LINE_MAX));
    expect(b.file!.cut).toBe(true);
  });

  test("bash und read behalten die Zeile von heute — kein Dateifeld, Text wie bisher", () => {
    const b = block("bash", { command: "git status --short" });
    expect(b.file).toBeUndefined();
    expect(b.text).toBe('{"command":"git status --short"}');
    const r = block("read", { path: "src/a.ts", offset: 1, limit: 20 });
    expect(r.file).toBeUndefined();
    expect(r.text).toBe('{"path":"src/a.ts","offset":1,"limit":20}');
  });
});

describe("ein kaputter Eintrag nimmt die Unterhaltung nicht mit", () => {
  const msg = (id: string, parent: string, role: string, content: unknown) => JSON.stringify({ type: "message", id, parentId: parent,
    timestamp: TS, message: { role, timestamp: 1761645600000, provider: "anthropic", model: "m", content } });

  test("ein null-Element in content einer Assistant-Nachricht: die übrigen Blöcke und die Nachbarn kommen an", () => {
    const r = readPiSession([kopf, frage,
      msg("a1", "u1", "assistant", [null, 7, { type: "text", text: "heil" }]),
      msg("u2", "a1", "user", [null, { type: "text", text: "weiter" }]),
      msg("t1", "u2", "toolResult", [null, { type: "text", text: "ergebnis" }])]);
    expect(r.entries.map((e) => e.blocks[0]!)).toEqual([
      { t: "text", text: "änder was" }, { t: "text", text: "heil" },
      { t: "text", text: "weiter" }, { t: "tool_result", text: "ergebnis" }]);
  });

  test("ein Pfad über der Kappe ist gekappt und als gekappt erkennbar", () => {
    const b = block("write", { path: "p/".repeat(PATH_MAX), content: "x" });
    expect(b.file!.path.length).toBeLessThan(PATH_MAX + 40);
    expect(b.file!.path).toContain("[+");
    expect(b.file!.cut).toBe(true);
  });

  test("ein Pfad unter der Kappe bleibt unberührt", () => {
    expect(block("write", { path: "a/b.ts", content: "x" }).file).toEqual({ path: "a/b.ts", after: ["x"], cut: false });
  });
});

describe("der Kopf einer Zustellung bleibt im pi-Zug, und die Chat-Ansicht faltet ihn wie bei Claude (W1)", () => {
  const kopfZeile = "[fleet-delivery · mailbox message · path=postfach · Slot 14 · next step: read the message and answer if needed · limit: no new authority] ";
  const zug = (text: unknown) => JSON.stringify({ type: "message", id: "u1", parentId: "s0", timestamp: TS,
    message: { role: "user", content: text } });
  test("der Leser reicht den Text mit Kopf unverändert durch, als String wie als Textblock", () => {
    for (const content of [`${kopfZeile}[fleet message] abc from Orchestrator\n\nhallo`, [{ type: "text", text: `${kopfZeile}hallo` }]]) {
      const e = readPiSession([kopf, zug(content)]).entries[0]!;
      expect(e.role).toBe("user");
      expect((e.blocks[0] as { text: string }).text.startsWith("[fleet-delivery · ")).toBe(true);
    }
  });
  test("Kopf und Text trennen sich, und der Zug ist Fleet, nicht der Owner; die Owner-Tür bleibt Owner", () => {
    const e = readPiSession([kopf, zug(`${kopfZeile}[fleet message] abc from Orchestrator\n\nhallo`)]).entries[0]!;
    const roh = (e.blocks[0] as { text: string }).text;
    const { header, body } = splitDeliveryHeader(roh);
    expect(header).toContain("path=postfach");
    expect(body.startsWith("[fleet message] abc")).toBe(true);
    expect(otherSender(roh)).toMatchObject({ who: "fleet" });
    expect(otherSender("[fleet-delivery · owner credential · Slot 14] mach das")).toBeNull();
  });
});

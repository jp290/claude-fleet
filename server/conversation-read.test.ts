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
import { FILE_LINES, LINE_MAX, SIDE_MAX, readPiSession, type TBlock } from "./conversation-read";

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

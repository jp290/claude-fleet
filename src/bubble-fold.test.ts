// src/bubble-fold.ts: eine lange Blase des Owners faltet (Brief 2026-10-29, Ziel 2) — der Anfang
// steht, ein leiser Knopf öffnet den Rest. Kurz bleibt kurz: keine Klasse, kein Knopf. Das Kopieren
// kopiert weiter den ganzen Text (addMessage kopiert `text`, nicht die Faltung).
import { describe, expect, test } from "bun:test";
import { FOLD_CHARS, FOLD_LINES, foldLabel, foldOwner } from "./bubble-fold";

describe("bubble-fold: die lange Blase des Owners", () => {
  test("eine kurze Blase faltet nicht, wie sie heute aussieht", () => {
    expect(foldOwner("kurze Nachricht")).toBe(false);
    expect(foldOwner("Zeile 1\nZeile 2\nZeile 3")).toBe(false);
    // die Grenze selbst ist noch kurz: FOLD_LINES Zeilen, FOLD_CHARS Zeichen
    expect(foldOwner(Array.from({ length: FOLD_LINES }, (_, i) => `Zeile ${i + 1}`).join("\n"))).toBe(false);
    expect(foldOwner("x".repeat(FOLD_CHARS))).toBe(false);
  });

  test("eine Blase über ein paar Zeilen faltet — der 43.808-Byte-Fall und ein breiter Einzeiler", () => {
    // die Meldung des Owners: 43.808 Bytes, Hunderte Zeilen
    const paste = "Eine lange Sendung des Owners, über der Paste-Grenze.\n".repeat(400);
    expect(paste.length).toBeGreaterThan(FOLD_CHARS);
    expect(foldOwner(paste)).toBe(true);
    // mehr Zeilen als die Grenze, auch mit kurzen Zeilen
    expect(foldOwner(Array.from({ length: FOLD_LINES + 1 }, (_, i) => `Zeile ${i + 1}`).join("\n"))).toBe(true);
    // ein Einzeiler über der Zeichen-Grenze faltet auch
    expect(foldOwner("x".repeat(FOLD_CHARS + 1))).toBe(true);
  });

  test("der Knopf nennt, wie viel sich öffnet, und den Weg zurück", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1}`).join("\n");
    expect(foldLabel(twelve, false)).toBe("Show all 12 lines");
    expect(foldLabel(twelve, true)).toBe("Show less");
    expect(foldLabel("x".repeat(900), false)).toBe("Show all"); // one wide line is not "1 lines"
  });
});

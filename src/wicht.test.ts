// Owner 25.10.: „[Zitat entfernt]“
//  Ein kleiner Wicht je laufendem Subagent, keiner sonst.
import { describe, expect, test } from "bun:test";
import { wichteOf } from "./wicht";

describe("wie viele Wichte auf dem Eingabefeld sitzen", () => {
  test("einer je laufendem Subagent", () => {
    expect(wichteOf({ background: { agents: 1, shells: 0 } })).toBe(1);
    expect(wichteOf({ background: { agents: 2, shells: 0 } })).toBe(2);
  });
  test("ohne Subagent keiner, auch wenn ein Befehl im Hintergrund läuft", () => {
    expect(wichteOf({ background: { agents: 0, shells: 0 } })).toBe(0);
    expect(wichteOf({ background: { agents: 0, shells: 2 } })).toBe(0);
    expect(wichteOf({ background: { agents: 1, shells: 3 } })).toBe(1);
  });
  test("ohne Live-Zustand (Terminal-Ansicht, vergangene Session) und von einem Server, der den Hintergrund nicht meldet: keiner", () => {
    expect(wichteOf(null)).toBe(0);
    expect(wichteOf({})).toBe(0);
  });
  test("viele Subagenten drängen sich nicht über die Kante: höchstens acht", () => {
    expect(wichteOf({ background: { agents: 12, shells: 0 } })).toBe(8);
  });
});

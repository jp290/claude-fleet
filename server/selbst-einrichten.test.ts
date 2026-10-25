// DIE TÜR, DIE NUR TEXT DAZUGIBT (server/selbst-einrichten.ts): was eine Session ihrer Nachfolgerin setzt, was die Nachfolge daraus macht,
// und was das Board als neu zählt
import { describe, expect, test } from "bun:test";
import { einrichtenDerTuer, einrichtenZeilen, mitNaechstem, nachfolgeZeile, neuGegenueber, selbstDerNachfolge, slotSelbstGeladen, type SlotSelbst } from "./selbst-einrichten";

const naechster = (body: unknown, s: SlotSelbst | null = null) => {
  const r = einrichtenDerTuer(body, s);
  if (!r.ok) throw new Error(r.error);
  return r.naechster;
};

describe("die Tür", () => {
  test("nimmt purpose und packs, sonst nichts: Rechte, Modell, Hooks und MCP haben kein Feld", () => {
    for (const fremd of [{ model: "x" }, { rechte: { stufe: "deployen" } }, { hooks: [] }, { mcp: ["x"] }, { purpose: "z", permissionMode: "bypassPermissions" }]) {
      const r = einrichtenDerTuer(fremd, null);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("only adds text");
    }
    expect(einrichtenDerTuer({}, null).ok).toBe(false);
    expect(einrichtenDerTuer({ purpose: "  " }, null).ok).toBe(false);
    expect(einrichtenDerTuer({ packs: ["a", "a"] }, null).ok).toBe(false);
    expect(einrichtenDerTuer({ packs: ["Gross"] }, null).ok).toBe(false);
  });
  test("ein fehlendes Feld bleibt, wie es für die Nachfolgerin steht; null nimmt den Zweck zurück, [] die Packs", () => {
    const s = mitNaechstem(null, naechster({ purpose: "Zweck", packs: ["a"] }));
    expect(naechster({ packs: ["a", "b"] }, s)).toEqual({ packs: ["a", "b"], zweck: "Zweck" });
    expect(naechster({ purpose: null }, s)).toEqual({ packs: ["a"], zweck: null });
    expect(naechster({ packs: [] }, s)).toEqual({ packs: [], zweck: "Zweck" });
  });
  test("die Zeilen sagen, was die Nachfolgerin gegenüber diesem Start mehr, weniger oder anders bekommt", () => {
    expect(einrichtenZeilen({ packs: ["a"], zweck: null }, { packs: ["b"], zweck: "Erste Zeile\nzweite" }))
      .toEqual(["+ Pack b", "− Pack a", "+ Zweck: Erste Zeile"]);
    expect(einrichtenZeilen({ packs: [], zweck: "alt" }, { packs: [], zweck: "neu" })).toEqual(["~ Zweck: neu"]);
    expect(einrichtenZeilen({ packs: [], zweck: "alt" }, { packs: [], zweck: null })).toEqual(["− Zweck"]);
  });
});

describe("die Nachfolge", () => {
  test("der nächste Start wird der jetzige, und neu ist, was die Vorgängerin nicht hatte", () => {
    const vor = mitNaechstem({ jetzt: { packs: ["a"], zweck: null }, naechster: null, neu: [] }, naechster({ purpose: "Z", packs: ["a", "b"] }));
    const nach = selbstDerNachfolge(vor);
    expect(nach).toEqual({ jetzt: { packs: ["a", "b"], zweck: "Z" }, naechster: null, neu: ["b", "purpose"] });
    expect(nachfolgeZeile(nach)).toContain("+ Pack b, + Zweck");
    // eine zweite Nachfolge ohne Änderung trägt alles weiter und hat nichts Neues
    expect(selbstDerNachfolge(nach)).toEqual({ jetzt: { packs: ["a", "b"], zweck: "Z" }, naechster: null, neu: [] });
    expect(nachfolgeZeile(selbstDerNachfolge(nach))).toBeNull();
  });
  test("was zurückgenommen ist, geht nicht mit; nichts gesetzt ist null", () => {
    expect(selbstDerNachfolge(null)).toBeNull();
    expect(mitNaechstem(null, { packs: [], zweck: null })).toBeNull();
    const s = mitNaechstem(mitNaechstem(null, naechster({ purpose: "Z" })), { packs: [], zweck: null });
    expect(selbstDerNachfolge(s)).toBeNull();
  });
  test("ein geänderter Zweck ist neu, derselbe nicht", () => {
    expect(neuGegenueber({ packs: [], zweck: "B" }, { packs: [], zweck: "A" })).toEqual(["purpose"]);
    expect(neuGegenueber({ packs: [], zweck: "A" }, { packs: [], zweck: "A" })).toEqual([]);
  });
  test("aus fleet.json nur eine lesbare Form", () => {
    const s: SlotSelbst = { jetzt: { packs: ["a"], zweck: "Z" }, naechster: { packs: [], zweck: null }, neu: ["a"] };
    expect(slotSelbstGeladen(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(slotSelbstGeladen({ jetzt: { packs: "a", zweck: null } })).toBeNull();
    expect(slotSelbstGeladen(null)).toBeNull();
  });
});

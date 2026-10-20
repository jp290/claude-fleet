// Konstellation Stück 2 · wer eine Session geöffnet hat (server/opener.ts): nur eine lebende Belegung mit Self-Token neben dem
// Owner-Bearer zählt, nie die Session selbst, und aus fleet.json kommt nur ein ganzer Datensatz zurück
import { describe, expect, test } from "bun:test";
import { openerGeladen, openerVon } from "./opener";
import type { Principal } from "./auth";

const slots = [{ id: 6, cwd: "/w/orch", openedAt: 600 }, { id: 4, cwd: null, openedAt: 0 }, { id: 8, cwd: "/w/neu", openedAt: 800 }];
const owner = (slot?: number, openedAt = 600): Principal =>
  ({ kind: "owner", via: "bearer", ...(slot ? { session: { kind: "session", slot, openedAt, role: "generic", label: "" } } : {}) });

describe("openerVon", () => {
  test("die Session mit Self-Token neben dem Owner-Bearer ist die Öffnerin", () => {
    expect(openerVon(owner(6), slots, slots[2]!)).toEqual({ slot: 6, openedAt: 600, cwd: "/w/orch" });
  });
  test("ohne Session, ohne Credential oder nur mit Self-Token: keine", () => {
    expect(openerVon(owner(), slots, slots[2]!)).toBeNull();
    expect(openerVon(null, slots, slots[2]!)).toBeNull();
    expect(openerVon({ kind: "session", slot: 6, openedAt: 600, role: "generic" }, slots, slots[2]!)).toBeNull();
  });
  test("eine beendete oder neu belegte Öffnerin und die Session selbst zählen nicht", () => {
    expect(openerVon(owner(6, 599), slots, slots[2]!)).toBeNull();
    expect(openerVon(owner(4, 0), slots, slots[2]!)).toBeNull();
    expect(openerVon(owner(8, 800), slots, slots[2]!)).toBeNull();
  });
});

describe("openerGeladen", () => {
  test("ein ganzer Datensatz kommt zurück", () => {
    expect(openerGeladen({ slot: 6, openedAt: 600, cwd: "/w/orch" })).toEqual({ slot: 6, openedAt: 600, cwd: "/w/orch" });
  });
  test("was fehlt oder nicht passt, ergibt null", () => {
    for (const x of [undefined, null, "6", { slot: 6, openedAt: 600 }, { slot: 6.5, openedAt: 600, cwd: "/w" },
      { slot: 6, openedAt: "600", cwd: "/w" }, { slot: 6, openedAt: 600, cwd: "" }, { slot: 6, openedAt: Infinity, cwd: "/w" }])
      expect(openerGeladen(x)).toBeNull();
  });
});

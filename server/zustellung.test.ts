// Die reine Logik der Zustellung je Setup (server/zustellung.ts): welcher Wert ohne Einstellung
// gilt, was Tür und Reload durchlassen, was im Teil „arbeitet“ steht und in den Hash geht, und
// welche Zustellart der Postfach-Takt daraus macht. Kein Server, keine Pane, keine Uhr.
import { describe, expect, test } from "bun:test";
import { baueFassung } from "./fassung";
import { planPostfachDelivery, postfachEntryText, type PostfachEntry } from "./postfach-zustellen";
import {
  ZUSTELLUNG_WERTE, postfachZustellart, zustellungAbschnitt, zustellungDerTuer, zustellungFuerSlot,
  zustellungGeladen, zustellungSatz, zustellungStandard, type Zustellung,
} from "./zustellung";

const now = 1_000_000;
const eintrag = (at: number): PostfachEntry => ({ id: "m1", at, from: "Session Slot 3", text: "der ganze Wortlaut",
  target: { kind: "session", slot: 7, openedAt: 100 } });

describe("Zustellung: der Standard nach Rolle", () => {
  test("eine Lane (Slot mit Worktree) bündelt, jede andere Session kommt direkt; die gesetzte Wahl schlägt den Standard", () => {
    expect(zustellungStandard(true)).toBe("gebuendelt");
    expect(zustellungStandard(false)).toBe("direkt");
    expect(zustellungFuerSlot(null, true)).toEqual({ wert: "gebuendelt", quelle: "standard" });
    expect(zustellungFuerSlot(undefined, false)).toEqual({ wert: "direkt", quelle: "standard" });
    expect(zustellungFuerSlot("direkt", true)).toEqual({ wert: "direkt", quelle: "gesetzt" });
    expect(zustellungFuerSlot("gebuendelt", false)).toEqual({ wert: "gebuendelt", quelle: "gesetzt" });
    // ein dritter Wert ist keine Wahl, sondern der Standard
    expect(zustellungFuerSlot("sofort", true)).toEqual({ wert: "gebuendelt", quelle: "standard" });
  });
});

describe("Zustellung: Speichern", () => {
  test("die Tür nimmt genau die zwei Werte, null löscht zur Wahl der Rolle zurück, Unbekanntes wird abgelehnt", () => {
    expect(ZUSTELLUNG_WERTE).toEqual(["direkt", "gebuendelt"]);
    expect(zustellungDerTuer({ zustellung: "direkt" })).toEqual({ ok: true, zustellung: "direkt" });
    expect(zustellungDerTuer({ zustellung: "gebuendelt" })).toEqual({ ok: true, zustellung: "gebuendelt" });
    expect(zustellungDerTuer({ zustellung: null })).toEqual({ ok: true, zustellung: null });
    expect(zustellungDerTuer({})).toMatchObject({ ok: false });
    expect(zustellungDerTuer(null)).toMatchObject({ ok: false });
    expect(zustellungDerTuer({ zustellung: "sofort" })).toMatchObject({ ok: false });
  });

  test("fleet.json gibt nur die zwei Werte zurück — ein handgeschriebener dritter lädt als nicht gesetzt", () => {
    expect(zustellungGeladen("direkt")).toBe("direkt");
    expect(zustellungGeladen("gebuendelt")).toBe("gebuendelt");
    expect(zustellungGeladen("sofort")).toBeNull();
    expect(zustellungGeladen(undefined)).toBeNull();
    expect(zustellungGeladen({ wert: "direkt" })).toBeNull();
  });
});

describe("Zustellung: die Fassung", () => {
  const fassungMit = (raw: unknown, hatWorktree: boolean) => baueFassung({
    slot: 7, anlass: "laufend", wer: [], aufgabe: [], liest: [], darf: [],
    arbeitet: [zustellungAbschnitt(raw, hatWorktree)],
  });
  const abschnitt = (f: ReturnType<typeof baueFassung>) =>
    f.teile.find((t) => t.id === "arbeitet")!.abschnitte.find((a) => a.id === "zustellung")!;

  test("Wert und Quelle stehen im Teil „arbeitet“ und gehen in den Hash ein", () => {
    const direkt = fassungMit("direkt", true);
    const gebuendelt = fassungMit("gebuendelt", true);
    expect(abschnitt(direkt).text).toContain("ZUSTELLUNG (vom Owner gesetzt): direkt");
    expect(abschnitt(gebuendelt).text).toContain("ZUSTELLUNG (vom Owner gesetzt): gebuendelt");
    expect(gebuendelt.hash).not.toBe(direkt.hash);

    // derselbe Wert, andere Quelle: Standard-Lane gegen ausdrücklich gesetzte Lane
    const standard = fassungMit(null, true);
    expect(abschnitt(standard).text).toContain("Standard für eine Lane");
    expect(abschnitt(standard).text).toContain(": gebuendelt —");
    expect(standard.hash).not.toBe(gebuendelt.hash);
    expect(fassungMit(null, true).hash).toBe(standard.hash);
    // die Rolle ändert den Standard und damit den Hash
    expect(fassungMit(null, false).hash).not.toBe(standard.hash);
    expect(zustellungSatz({ wert: "direkt", quelle: "gesetzt" })).toContain("vom Owner gesetzt");
    expect(zustellungSatz({ wert: "direkt", quelle: "standard" })).toContain("Standard für diese Session");
  });
});

describe("Zustellung: welche Zustellart greift", () => {
  test("direkt wartet das Postfach-Fenster und geht als sofort; gebuendelt ist sofort fällig und geht ins Bündel", () => {
    const direkt = postfachZustellart("direkt", 60_000);
    const gebuendelt = postfachZustellart("gebuendelt", 60_000);
    expect(direkt).toEqual({ fensterMs: 60_000, deliveryClass: "sofort", gebuendelt: false });
    expect(gebuendelt).toEqual({ fensterMs: 0, deliveryClass: "buendelbar", gebuendelt: true });
    // 10 Sekunden alt: direkt ist noch nicht fällig, gebuendelt geht sofort mit Wortlaut ins Bündel
    const frisch = [eintrag(now - 10_000)];
    expect(planPostfachDelivery(frisch, now, { windowMs: direkt.fensterMs, maxChars: 8_000 })).toBeNull();
    const plan = planPostfachDelivery(frisch, now, { windowMs: gebuendelt.fensterMs, maxChars: 8_000 });
    expect(plan?.entries.map((e) => e.id)).toEqual(["m1"]);
    expect(plan?.text).toBe(postfachEntryText(frisch[0]!));
  });

  test("eine gesetzte Wahl wird als solche benutzt, egal welche Rolle der Slot hat", () => {
    const lane: Zustellung = zustellungFuerSlot("direkt", true).wert;
    const session: Zustellung = zustellungFuerSlot("gebuendelt", false).wert;
    expect(postfachZustellart(lane, 60_000).deliveryClass).toBe("sofort");
    expect(postfachZustellart(session, 60_000).deliveryClass).toBe("buendelbar");
  });
});

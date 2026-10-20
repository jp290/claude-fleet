// Die Aufgabe eines Starts (Harness 2.0 Schritt 3, src/aufgabe.ts): Ziel, Grenze, fertig wenn, Beleg, Rückweg. Die Branch-Tür nimmt sie, die
// Session bekommt sie als erste Nachricht, die Historie trägt sie als Objekt.
import { afterAll, describe, expect, test } from "bun:test";
import { AUFGABE_MAX, aufgabeAlsText, aufgabeAus } from "../src/aufgabe";
import { branchTestkit, get, LIFE_DEADLINE_MS, post } from "./branches-testkit";

describe("aufgabeAus", () => {
  test("nimmt Ziel und Felder, schneidet Ränder ab und lässt leere Felder weg", () => {
    expect(aufgabeAus({ ziel: " Plan lesen ", grenze: "nur docs/", fertig: "", beleg: "bun test", rueckweg: "an Slot 8" }))
      .toEqual({ ziel: "Plan lesen", grenze: "nur docs/", beleg: "bun test", rueckweg: "an Slot 8" });
  });
  test("lehnt ab: kein Objekt, kein Ziel, ein fremdes Feld, kein Text, zu lang", () => {
    expect(typeof aufgabeAus("Plan lesen")).toBe("string");
    expect(aufgabeAus({ ziel: "  ", grenze: "x" })).toBe("eine Aufgabe braucht ein Ziel");
    expect(aufgabeAus({ ziel: "x", wer: "y" })).toBe("aufgabe kennt kein Feld „wer“");
    expect(aufgabeAus({ ziel: "x", runden: 3 })).toBe("aufgabe kennt kein Feld „runden“");
    expect(aufgabeAus({ ziel: "x", grenze: 3 })).toBe("jedes Feld der Aufgabe ist Text");
    expect(typeof aufgabeAus({ ziel: "x".repeat(AUFGABE_MAX + 1) })).toBe("string");
  });
});

describe("aufgabeAlsText", () => {
  test("nur mit Ziel ist die Nachricht das Ziel selbst", () => {
    expect(aufgabeAlsText({ ziel: "Plan lesen" })).toBe("Plan lesen");
  });
  test("mit Feldern je Feld eine Zeile, in fester Reihenfolge", () => {
    expect(aufgabeAlsText({ ziel: "Plan lesen", rueckweg: "an Slot 8", grenze: "nur docs/" }))
      .toBe("Ziel: Plan lesen\nGrenze: nur docs/\nRückweg: an Slot 8");
  });
});

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

describe("die Branch-Tür nimmt eine Aufgabe", () => {
  test("die Historie trägt die Aufgabe und als Ziel ihren Text; goal und aufgabe zugleich, eine Aufgabe ohne Ziel werden abgelehnt", async () => {
    const f = fixture();
    const aufgabe = { ziel: "Plan lesen", grenze: "nur docs/", fertig: "ein Satz Stand", beleg: "git log", rueckweg: "an Slot 8" };
    const [made, beide, leer, opened, h] = await life(f, [post("/api/branches", { repo: f.repo, name: "Aufgabe A" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/aufgabe-a", goal: "x", aufgabe }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/aufgabe-a", aufgabe: { grenze: "nur docs/" } }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/aufgabe-a", aufgabe }), get("/api/k15/historie")]);
    expect(made?.status).toBe(201);
    expect([beide?.status, leer?.status]).toEqual([400, 400]);
    expect(leer?.body.error).toBe("eine Aufgabe braucht ein Ziel");
    expect(opened?.status).toBe(200);
    const starts = h?.body.starts as { slot: number; goal: string | null; aufgabe: object | null }[];
    expect(starts[0]).toMatchObject({ slot: Number(opened?.body.slot), aufgabe, goal: aufgabeAlsText(aufgabe) });
  }, LIFE_DEADLINE_MS);
});

// Die Fassung reist mit (Harness 2.0, erster prüfbarer Abschluss, harness-2-0-antwort.md §3: „Ein Export davon wird auf der Testinstanz
// importiert … und der Lauf lässt sich dort neu fahren. Der neue Lauf verweist auf dieselbe Fassung.“): eine gespeicherte Konstellation,
// exportiert, in einer anderen Fleet importiert und dort gespeichert, hat denselben Hash.
import { describe, expect, test } from "bun:test";
import { DU, PROFILE0, exportJson, exportObjekt, pos, type Konst, type Profil } from "../src/k15-entwurf-modell";
import { abschnitte, importKonst } from "../src/k15-import";
import { fassungsHash } from "./konst-fassungen";

// so legt das Fenster eine Konstellation am Server ab (src/k15-zustand.ts#konstForm)
const form = (k: Konst, profile: readonly Profil[]): Record<string, unknown> =>
  ({ id: k.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [k], k, profile: [...profile], q: null, p: profile[0] ?? PROFILE0[0]! }) });

const BAUER: Profil = { ...PROFILE0.find((p) => p.id === "bau")!, id: "bauer-eigen", name: "Bauer", autor: DU, modell: "claude-opus-5-5[1m]" };
const HIER = [...PROFILE0, BAUER];
const V1: Konst = { id: "k1", name: "Bauer und Gegenspieler", v: 3, satz: "zwei Sessions", eigen: true,
  protokoll: { ende: "Die CI des Repos ist grün.", runden: 3, regel: "Der Gegenspieler bricht ihn nicht mehr." },
  wurzeln: [pos("bauer", "Bauer", "bauer-eigen", { kids: [pos("gegen", "Gegenspieler", "bau")] })] };

describe("eine Fassung reist mit Export und Import", () => {
  test("in eine frische Fleet: derselbe Hash", () => {
    const hier = form(V1, HIER);
    const imp = importKonst(exportJson({ ebene: "konst", voll: true, konst: [V1], k: V1, profile: HIER, q: null, p: HIER[0]! }), PROFILE0, 1792000000000);
    if (typeof imp === "string") throw new Error(imp);
    const dort = form(imp.k, [...PROFILE0, ...imp.neueProfile]);
    expect(fassungsHash(dort)).toBe(fassungsHash(hier));
  });
  test("zurück in die eigene Fleet, wo alles schon da ist: derselbe Hash", () => {
    const imp = importKonst(exportJson({ ebene: "konst", voll: true, konst: [V1], k: V1, profile: HIER, q: null, p: HIER[0]! }), HIER, 1792000000000);
    if (typeof imp === "string") throw new Error(imp);
    expect(fassungsHash(form(imp.k, [...HIER, ...imp.neueProfile]))).toBe(fassungsHash(form(V1, HIER)));
  });
  // eine eigene Datei, wie das Fenster sie aus einer hineingezogenen .md macht (k15-import.ts#abschnitte zählt bytes je Abschnitt)
  test("mit einer eigenen Datei: derselbe Hash", () => {
    const md = "# Regeln\nLies jeden Diff.\n## Melden\nEin Satz Urteil.";
    const mitDatei: Konst = { ...V1, wurzeln: [pos("bauer", "Bauer", "bauer-eigen", { datei: { titel: "regeln.md", v: 1, pfad: "eigene Datei", abschnitte: abschnitte(md, "Anfang") },
      kids: [pos("gegen", "Gegenspieler", "bau")] })] };
    const imp = importKonst(exportJson({ ebene: "konst", voll: true, konst: [mitDatei], k: mitDatei, profile: HIER, q: null, p: HIER[0]! }), PROFILE0, 1792000000000);
    if (typeof imp === "string") throw new Error(imp);
    expect(fassungsHash(form(imp.k, [...PROFILE0, ...imp.neueProfile]))).toBe(fassungsHash(form(mitDatei, HIER)));
  });
  // docs/konstellation/restplan.md T3: „Export → Import ergibt denselben Hash und dieselbe Aufgabe“
  test("mit ihrer Aufgabe: dieselbe Aufgabe und derselbe Hash, und die Aufgabe zählt in den Hash", () => {
    const mitAufgabe: Konst = { ...V1, aufgabe: { ziel: "Den Bericht prüfen", fertig: "Jeder Befund hat ein Urteil.", rueckweg: "an den Owner" } };
    const imp = importKonst(exportJson({ ebene: "konst", voll: true, konst: [mitAufgabe], k: mitAufgabe, profile: HIER, q: null, p: HIER[0]! }), PROFILE0, 1792000000000);
    if (typeof imp === "string") throw new Error(imp);
    expect(imp.k.aufgabe).toEqual(mitAufgabe.aufgabe);
    expect(fassungsHash(form(imp.k, [...PROFILE0, ...imp.neueProfile]))).toBe(fassungsHash(form(mitAufgabe, HIER)));
    expect(fassungsHash(form(mitAufgabe, HIER))).not.toBe(fassungsHash(form(V1, HIER)));
  });
});

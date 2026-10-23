// K15 · was von außen ins Fenster kommt, gegen die Prüfung der Bauleitung vom 16.10. (k15-pruefung-16-10.md auf bau/neuaufbau):
// 1 „[Zitat entfernt]“;
// 6 „[Zitat entfernt]“; 8 „[Zitat entfernt]“;
// 9 „[Zitat entfernt]“.
import { describe, expect, test } from "bun:test";
import { DU, KONST0, PROFILE0, alle, exportJson, exportObjekt, pos, type Konst, type Profil } from "./k15-entwurf-modell";
import { MAX_POSITIONEN, abschnitte, dateiPasst, importKonst, profilAus } from "./k15-import";

const imp = (o: unknown, profile: readonly Profil[] = PROFILE0) => importKonst(JSON.stringify(o), profile, 7);
const k = (positionen: unknown[]) => ({ fleet: "konstellation", name: "K", positionen });

describe("eine schiefe Konstellation wird mit einem Satz abgelehnt", () => {
  test.each([
    ["Kennung als Zahl (der Fall aus der Prüfung)", k([{ id: 1, profil: "lane" }]), /^Session 1 hat keine gültige Kennung$/],
    ["null statt eines Objekts", null, /^das ist kein Export aus diesem Fenster$/],
    ["eine Position null", k([null]), /^Session 1 hat keine gültige Kennung$/],
    ["eine Position ohne id", k([{ name: "x", profil: "lane" }]), /^Session 1 hat keine gültige Kennung$/],
    ["keine Positionen", k([]), /^die Konstellation hat keine Sessions$/],
    ["positionen kein Array", { fleet: "konstellation", positionen: { a: 1 } }, /^die Konstellation hat keine Sessions$/],
    ["meldetAn auf eine Session, die es nicht gibt", k([{ id: "a", profil: "lane", meldetAn: "z" }]), /^a meldet an eine Session, die es im Export nicht gibt$/],
    ["meldet an sich selbst", k([{ id: "a", profil: "lane", meldetAn: "a" }]), /^a meldet an sich selbst$/],
    ["ein Kreis", k([{ id: "a", profil: "lane", meldetAn: "b" }, { id: "b", profil: "lane", meldetAn: "a" }]), /^die Meldewege bilden einen Kreis$/],
    ["zwei gleiche Kennungen", k([{ id: "a", profil: "lane" }, { id: "a", profil: "main" }]), /^zwei Sessions tragen dieselbe Kennung$/],
    ["Name keine Zeichenkette", k([{ id: "a", name: 5, profil: "lane" }]), /^Session a hat keinen gültigen Namen$/],
    ["Schalter mit fremdem Wert", k([{ id: "a", profil: "lane", schalter: { x: "vielleicht" } }]), /^Session a: ihre Einstellungen passen nicht$/],
    ["abweichend mit fremdem Feld", k([{ id: "a", profil: "lane", abweichend: { farbe: "rot" } }]), /^Session a: ihre Einstellungen passen nicht$/],
    ["zu viele Sessions", k(Array.from({ length: MAX_POSITIONEN + 1 }, (_, i) => ({ id: `p${i}`, profil: "lane" }))), /^25 Sessions sind mehr, als ein Aufbau hier trägt \(höchstens 24\)$/],
  ])("%s", (_, o, satz) => {
    expect(imp(o)).toMatch(satz);
  });
  test("kein JSON", () => expect(importKonst("{kaputt", PROFILE0, 7)).toBe("kein gültiges JSON"));
  test("ein Verweis auf ein Profil, das es hier nicht gibt, fällt nicht still auf ein anderes zurück", () => {
    expect(imp(k([{ id: "a", profil: "review@2" }]))).toBe("a: das Profil „review“ gibt es hier nicht; exportier vollständig, dann reist es mit");
  });
});

describe("eine gültige Konstellation kommt mit ihren Eltern", () => {
  test("meldetAn baut den Baum", () => {
    const r = imp(k([{ id: "m", profil: "main@5" }, { id: "l", name: "Lane 1", profil: "lane@3", meldetAn: "m" }]));
    if (typeof r === "string") throw new Error(r);
    expect(r.k.wurzeln.map((x) => x.name)).toEqual(["m"]);
    expect(r.k.wurzeln[0].kids?.map((x) => [x.name, x.profil])).toEqual([["Lane 1", "lane"]]);
    expect(r.neueProfile).toEqual([]);
  });
});

describe("der vollständige Export verliert nichts (Punkt 6)", () => {
  const review: Profil = { ...PROFILE0.find((p) => p.id === "eigen")!, id: "md1", name: "Review", autor: DU, rolle: "lane", schiene: "lane", effort: "high",
    datei: { id: "f1", titel: "review.md", v: 1, pfad: "eigene Datei", abschnitte: [{ titel: "# Review", text: "Lies jeden Diff." }] } };
  const konst: Konst = { id: "x", name: "Mit Review", v: 2, satz: "s", eigen: true, quer: "geht quer", wurzeln: [
    pos("m", "MAIN", "main", { kids: [pos("r", "Review", "md1", { wann: "nach jedem Land", ohne: ["teil:footer"],
      datei: { id: "f2", titel: "extra.md", v: 1, pfad: "eigene Datei", abschnitte: [{ titel: "# Extra", text: "x" }] } })] })] };
  const text = exportJson({ ebene: "konst", voll: true, konst: [konst], k: konst, profile: [...PROFILE0, review], q: null, p: review });
  test("Datei, wann, ohneTeile und quer kommen zurück, das fehlende Profil reist mit", () => {
    const r = importKonst(text, PROFILE0, 7);
    if (typeof r === "string") throw new Error(r);
    const rv = alle(r.k.wurzeln).find((x) => x.name === "Review");
    expect([rv?.wann, rv?.ohne, rv?.datei?.titel, rv?.datei?.abschnitte, r.k.quer]).toEqual(
      ["nach jedem Land", ["teil:footer"], "extra.md", [{ titel: "# Extra", text: "x" }], "geht quer"]);
    expect(r.neueProfile.map((p) => [p.id, p.name, p.rolle, p.effort, p.datei?.titel])).toEqual([["md1", "Review", "lane", "high", "review.md"]]);
    expect(rv?.profil).toBe("md1");
  });
  test("ist das Profil hier gleich, nimmt der Import das hiesige", () => {
    const r = importKonst(text, [...PROFILE0, review], 7);
    if (typeof r === "string") throw new Error(r);
    expect(r.neueProfile).toEqual([]);
    expect(alle(r.k.wurzeln).find((x) => x.name === "Review")?.profil).toBe("md1");
  });
  test("ist es hier anders, kommt es als eigenes dazu und das hiesige bleibt", () => {
    const anders = { ...review, effort: "low" };
    const r = importKonst(text, [...PROFILE0, anders], 7);
    if (typeof r === "string") throw new Error(r);
    expect(r.neueProfile.map((p) => [p.name, p.effort])).toEqual([["Review (importiert)", "high"]]);
    expect(r.neueProfile[0].id).not.toBe("md1");
    expect(r.hinweise).toContain("Review ist hier anders und kommt als „Review (importiert)“ dazu");
  });
});

describe("eine gespeicherte Konstellation (Konstellation Stück 1) kommt als derselbe Aufbau zurück", () => {
  const orch = KONST0.find((x) => x.id === "orch")!;
  const eigene: Konst = { ...structuredClone(orch), id: "n1", name: "Orchestratorin → freie Session", v: 3, eigen: true };
  const roh = { id: eigene.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [eigene], k: eigene, profile: PROFILE0, q: null, p: PROFILE0[0] }) };
  test("Kennung, Fassung, Positionen und ihre Kennungen bleiben, und kein Profil kommt doppelt", () => {
    const r = importKonst(JSON.stringify(roh), PROFILE0, 7, "n1");
    if (typeof r === "string") throw new Error(r);
    expect([r.k.id, r.k.name, r.k.v, r.k.eigen]).toEqual(["n1", "Orchestratorin → freie Session", 3, true]);
    const zeile = (ps: ReturnType<typeof alle>) => ps.map((x) => [x.id, x.name, x.profil, x.kids?.map((c) => c.id) ?? []]);
    expect(zeile(alle(r.k.wurzeln))).toEqual(zeile(alle(eigene.wurzeln)));
    expect(alle(r.k.wurzeln).find((x) => x.id === "l2")?.abw).toEqual({ modell: "claude-sonnet-5-5", effort: "medium" });
    expect(r.neueProfile).toEqual([]);
  });
  test("ohne Kennung bekommt die Konstellation eine neue, ihre Sessions behalten ihre (dieselbe Fassung, server/fassung-reise.test.ts)", () => {
    const r = importKonst(JSON.stringify(roh), PROFILE0, 7);
    if (typeof r === "string") throw new Error(r);
    expect([r.k.id, alle(r.k.wurzeln)[0]?.id]).toEqual(["i7", "o"]);
  });
  test("eine schiefe gespeicherte Konstellation wird abgelehnt wie ein Import", () => {
    expect(importKonst(JSON.stringify({ ...roh, positionen: [] }), PROFILE0, 7, "n1")).toBe("die Konstellation hat keine Sessions");
  });
});

describe("ein Profil aus dem Speicher", () => {
  test("geht hin und zurück, mit seiner Datei", () => {
    const p: Profil = { ...PROFILE0[2], id: "md9", name: "X", autor: DU, datei: { id: "f", titel: "x.md", v: 1, pfad: "p", abschnitte: [{ titel: "# X", text: "t" }] } };
    expect(profilAus(JSON.parse(JSON.stringify(p)))).toEqual({ ...p, nativ: null });
  });
  test("ohne Rolle oder mit fremder Schiene ist es keines", () => {
    expect(profilAus({ id: "a", rolle: "chef", schiene: "lane" })).toBeNull();
    expect(profilAus({ id: "a", rolle: "lane", schiene: "rakete" })).toBeNull();
  });
});

describe("Abschnitte einer Agent-MD (Punkt 8)", () => {
  test("eine Überschrift in einem Code-Block teilt nicht", () => {
    const md = "# Setup\nSo geht es:\n```bash\n# install deps\nbun install\n```\n## Danach\nweiter";
    expect(abschnitte(md, "Anfang").map((a) => [a.titel, a.text])).toEqual([
      ["# Setup", "So geht es:\n```bash\n# install deps\nbun install\n```"], ["## Danach", "weiter"]]);
  });
  test("~~~ und längere Zäune; ein ``` in einem ~~~-Block schließt ihn nicht", () => {
    const md = "# A\n~~~\n```\n# nicht\n~~~\n# B\n````\n# auch nicht\n````";
    expect(abschnitte(md, "Anfang").map((a) => a.titel)).toEqual(["# A", "# B"]);
  });
  test("Text vor der ersten Überschrift ist der Anfang; leer fällt er weg", () => {
    expect(abschnitte("vorweg\n# A\nx", "Anfang").map((a) => a.titel)).toEqual(["Anfang", "# A"]);
    expect(abschnitte("\n# A\nx", "Anfang").map((a) => a.titel)).toEqual(["# A"]);
  });
});

describe("welche Dateien das Fenster annimmt (Punkt 9)", () => {
  test("nur .md und .json bis 1 MB", () => {
    expect(dateiPasst("agent.md", 2_000)).toBeNull();
    expect(dateiPasst("k.fleet.json", 2_000)).toBeNull();
    expect(dateiPasst("film.mp4", 2_000)).toBe("film.mp4: Nur eine .md (Agent-MD) oder eine exportierte .json lässt sich hineinziehen.");
    expect(dateiPasst("gross.md", 2_500_000)).toBe("gross.md: 2.500 KB sind zu groß; mehr als 1 MB liest das Fenster nicht.");
  });
});

describe("das Protokoll einer Konstellation (Harness 2.0 Schritt 3) reist mit", () => {
  const orch = KONST0.find((x) => x.id === "orch")!;
  const form = (k: Konst) => exportObjekt({ ebene: "konst", voll: true, konst: [k], k, profile: PROFILE0, q: null, p: PROFILE0[0] });
  test("Endbedingung, Rundendeckel und Prüfregel kommen gleich zurück", () => {
    const protokoll = { ende: "Die CI des Repos ist grün.", runden: 3, regel: "Der Gegenspieler bricht den Schnitt nicht mehr." };
    const r = importKonst(JSON.stringify(form({ ...structuredClone(orch), protokoll })), PROFILE0, 7);
    if (typeof r === "string") throw new Error(r);
    expect(r.k.protokoll).toEqual(protokoll);
  });
  test("eine abgeschaltete Endbedingung bleibt aus", () => {
    const r = importKonst(JSON.stringify(form({ ...structuredClone(orch), protokoll: { ende: null, runden: 2, regel: null } })), PROFILE0, 7);
    if (typeof r === "string") throw new Error(r);
    expect(r.k.protokoll).toEqual({ ende: null, runden: 2, regel: null });
  });
  test("ein leeres Protokoll reist nicht mit: die Form bleibt die von vorher", () => {
    expect(form({ ...structuredClone(orch), protokoll: { ende: null, runden: null, regel: null } })).toEqual(form(structuredClone(orch)));
  });
  test("ein schiefes Protokoll wird abgelehnt", () => {
    const roh = form(structuredClone(orch));
    expect(imp({ ...roh, protokoll: { ende: 3, runden: null, regel: null } })).toBe("das Protokoll passt nicht");
    expect(imp({ ...roh, protokoll: { ende: null, runden: 0, regel: null } })).toBe("das Protokoll passt nicht");
    expect(imp({ ...roh, protokoll: "CI" })).toBe("das Protokoll passt nicht");
  });
});

// Abnahme datei-traegt 22.10. (MUSS 1): Rechte an der Position gäbe das Fenster als body.rechte an die Tür, und die gehen dort vor dem Deckel
// aus sitz.darf (server/sitz-reise.ts#sitzDerTuer). Darum nimmt eine Datei sie nie an die Position; nur der eigene Speicher (behalte) behält sie
describe("Rechte an einer Position kommen nur aus dem eigenen Speicher", () => {
  const DEPLOYEN = { stufe: "deployen" as const, an: [] as string[], aus: [] as string[] };
  const mitRechten = { fleet: "konstellation", name: "K", positionen: [{ id: "a", profil: "lane", rechte: DEPLOYEN }] };
  test("aus einer Datei: keine Rechte an der Position", () => {
    const r = imp(mitRechten);
    if (typeof r === "string") throw new Error(r);
    expect(r.k.wurzeln[0]?.rechte).toBeUndefined();
  });
  test("aus dem eigenen Speicher: die Rechte bleiben", () => {
    const r = importKonst(JSON.stringify(mitRechten), PROFILE0, 7, "k1");
    if (typeof r === "string") throw new Error(r);
    expect(r.k.wurzeln[0]?.rechte).toEqual(DEPLOYEN);
  });
  test("der Export aus dem Fenster (teilen) trägt keine Rechte an der Position", () => {
    const kk: Konst = { id: "k1", name: "K", v: 1, satz: "", eigen: true, wurzeln: [pos("a", "A", "lane", { rechte: { stufe: "deployen", an: [], aus: [] } })] };
    const geteilt = exportObjekt({ ebene: "konst", voll: true, konst: [kk], k: kk, profile: PROFILE0, q: null, p: PROFILE0[0]!, teilen: true });
    const gespeichert = exportObjekt({ ebene: "konst", voll: true, konst: [kk], k: kk, profile: PROFILE0, q: null, p: PROFILE0[0]! });
    expect([JSON.stringify(geteilt).includes("deployen"), JSON.stringify(gespeichert).includes("deployen")]).toEqual([false, true]);
  });
});

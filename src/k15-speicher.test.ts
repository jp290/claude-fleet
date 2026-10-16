// K15 · was der Server als eigene Profile, Fassungen und Packs annimmt (src/k15-speicher.ts#speicherFehler): die Form, die das Fenster
// schickt, geht durch; alles andere bekommt einen Satz, der sagt, was nicht passt
import { describe, expect, test } from "bun:test";
import { MAX_FASSUNGEN, MAX_PACKS, MAX_PROFILE, speicherFehler } from "./k15-speicher";

const fassung = { abschnitt: "lane|regeln", text: "Meine Regeln", version: 2 };
const pack = { id: "pk1", name: "Wissen", text: "Was die Lane wissen soll", orte: { lane: "text" } };
const profil = { id: "p1", rolle: "lane", schiene: "lane", name: "Mein Agent", datei: { titel: "agent.md", abschnitte: [] } };
const gut = { fassungen: [fassung], packs: [pack], profile: [profil] };
const viele = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);

describe("speicherFehler", () => {
  test("die Form des Fensters geht durch, auch leer und genau an den Grenzen", () => {
    expect(speicherFehler(gut)).toBeNull();
    expect(speicherFehler({ fassungen: [], packs: [], profile: [] })).toBeNull();
    expect(speicherFehler({ fassungen: viele(MAX_FASSUNGEN, fassung), packs: viele(MAX_PACKS, pack), profile: viele(MAX_PROFILE, profil) })).toBeNull();
  });
  test("kein Objekt: null, Liste, Text, Zahl", () => {
    for (const x of [null, undefined, [gut], "gut", 3])
      expect(speicherFehler(x)).toBe("erwartet ist ein Objekt mit fassungen, packs und profile");
  });
  test("ein fremdes Feld wird genannt", () => {
    expect(speicherFehler({ ...gut, token: "x" })).toBe("unbekanntes Feld „token“");
  });
  test("jede der drei Listen muss da und eine Liste sein", () => {
    expect(speicherFehler({ packs: [], profile: [] })).toBe("„fassungen“ fehlt oder ist keine Liste");
    expect(speicherFehler({ ...gut, packs: { 0: pack } })).toBe("„packs“ fehlt oder ist keine Liste");
    expect(speicherFehler({ ...gut, profile: "p1" })).toBe("„profile“ fehlt oder ist keine Liste");
  });
  test("eins über der Grenze wird abgelehnt, je Liste", () => {
    expect(speicherFehler({ ...gut, fassungen: viele(MAX_FASSUNGEN + 1, fassung) })).toBe("201 Fassungen sind mehr als 200");
    expect(speicherFehler({ ...gut, packs: viele(MAX_PACKS + 1, pack) })).toBe("51 Packs sind mehr als 50");
    expect(speicherFehler({ ...gut, profile: viele(MAX_PROFILE + 1, profil) })).toBe("41 Profile sind mehr als 40");
  });
  test("ein Eintrag ohne seine Pflichtfelder als Text wird mit Stelle genannt", () => {
    expect(speicherFehler({ ...gut, fassungen: [fassung, { abschnitt: "lane|x" }] })).toBe("Eintrag 2 in „fassungen“ braucht abschnitt, text als Text");
    expect(speicherFehler({ ...gut, packs: [{ ...pack, id: 7 }] })).toBe("Eintrag 1 in „packs“ braucht id, name, text als Text");
    expect(speicherFehler({ ...gut, profile: [profil, profil, null] })).toBe("Eintrag 3 in „profile“ braucht id, rolle, schiene als Text");
    expect(speicherFehler({ ...gut, profile: [[profil]] })).toBe("Eintrag 1 in „profile“ braucht id, rolle, schiene als Text");
  });
  test("ein geerbtes Feld zählt nicht als eigenes", () => {
    expect(speicherFehler({ ...gut, fassungen: [Object.create(fassung)] })).toBe("Eintrag 1 in „fassungen“ braucht abschnitt, text als Text");
  });
});

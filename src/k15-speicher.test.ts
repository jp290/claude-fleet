// K15 · was der Server als eigene Profile, Fassungen und Packs annimmt (src/k15-speicher.ts#speicherFehler): die Form, die das Fenster
// schickt, geht durch; alles andere bekommt einen Satz, der sagt, was nicht passt
import { describe, expect, test } from "bun:test";
import { MAX_FASSUNGEN, MAX_KONSTELLATIONEN, MAX_PACKS, MAX_PROFILE, speicherFehler } from "./k15-speicher";

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
      expect(speicherFehler(x)).toBe("expected an object with fassungen, packs and profile");
  });
  test("ein fremdes Feld wird genannt", () => {
    expect(speicherFehler({ ...gut, token: "x" })).toBe("unknown field “token”");
  });
  test("jede der drei Listen muss da und eine Liste sein", () => {
    expect(speicherFehler({ packs: [], profile: [] })).toBe("“fassungen” is missing or not a list");
    expect(speicherFehler({ ...gut, packs: { 0: pack } })).toBe("“packs” is missing or not a list");
    expect(speicherFehler({ ...gut, profile: "p1" })).toBe("“profile” is missing or not a list");
  });
  test("eins über der Grenze wird abgelehnt, je Liste", () => {
    expect(speicherFehler({ ...gut, fassungen: viele(MAX_FASSUNGEN + 1, fassung) })).toBe("201 Fassungen are more than 200");
    expect(speicherFehler({ ...gut, packs: viele(MAX_PACKS + 1, pack) })).toBe("51 Packs are more than 50");
    expect(speicherFehler({ ...gut, profile: viele(MAX_PROFILE + 1, profil) })).toBe("41 Profile are more than 40");
  });
  test("ein Eintrag ohne seine Pflichtfelder als Text wird mit Stelle genannt", () => {
    expect(speicherFehler({ ...gut, fassungen: [fassung, { abschnitt: "lane|x" }] })).toBe("entry 2 in “fassungen” needs abschnitt, text as text");
    expect(speicherFehler({ ...gut, packs: [{ ...pack, id: 7 }] })).toBe("entry 1 in “packs” needs id, name, text as text");
    expect(speicherFehler({ ...gut, profile: [profil, profil, null] })).toBe("entry 3 in “profile” needs id, rolle, schiene as text");
    expect(speicherFehler({ ...gut, profile: [[profil]] })).toBe("entry 1 in “profile” needs id, rolle, schiene as text");
  });
  test("Konstellationen: eine vierte Liste, die fehlen darf (ein Fenster von vorher), sonst wie die anderen geprüft", () => {
    const konst = { id: "n1", name: "Orchestratorin → freie Session", fleet: "konstellation", positionen: [] };
    expect(speicherFehler({ ...gut, konstellationen: [konst] })).toBeNull();
    expect(speicherFehler({ ...gut, konstellationen: viele(MAX_KONSTELLATIONEN, konst) })).toBeNull();
    expect(speicherFehler({ ...gut, konstellationen: viele(MAX_KONSTELLATIONEN + 1, konst) })).toBe("51 Konstellationen are more than 50");
    expect(speicherFehler({ ...gut, konstellationen: null })).toBe("“konstellationen” is missing or not a list");
    expect(speicherFehler({ ...gut, konstellationen: [{ id: "n1" }] })).toBe("entry 1 in “konstellationen” needs id, name as text");
  });
  test("ein geerbtes Feld zählt nicht als eigenes", () => {
    expect(speicherFehler({ ...gut, fassungen: [Object.create(fassung)] })).toBe("entry 1 in “fassungen” needs abschnitt, text as text");
  });
});

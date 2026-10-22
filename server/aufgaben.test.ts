// Die Aufgaben-Dateien (docs/aufgaben/*.fleet.json): eine Konstellation mit ihrer Aufgabe, ihrer Prüfregel und ihren Läufen als Bericht,
// in der Form, die das Fenster exportiert (src/k15-export.ts). Auftrag der Orchestratorin 21.10.: „[Zitat entfernt]“
// 
//  Geprüft wird, was eine andere Fleet mit der Datei tut: sie importieren und die Fassung nachrechnen.
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PROFILE0, alle, exportObjekt, type Konst, type Profil } from "../src/k15-entwurf-modell";
import { importKonst } from "../src/k15-import";
import { fassungsHash } from "./konst-fassungen";

const DIR = join(import.meta.dir, "..", "docs", "aufgaben");
const DATEIEN = readdirSync(DIR).filter((f) => f.endsWith(".fleet.json")).sort();
const lies = (f: string) => Bun.file(join(DIR, f)).text();
// so legt das Fenster eine Konstellation am Server ab (src/k15-zustand.ts#konstForm), wie server/fassung-reise.test.ts
const form = (k: Konst, profile: readonly Profil[]): Record<string, unknown> =>
  ({ id: k.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [k], k, profile: [...profile], q: null, p: profile[0] ?? PROFILE0[0]! }) });
const frisch = async (f: string) => {
  const imp = importKonst(await lies(f), PROFILE0, 1792000000000);
  if (typeof imp === "string") throw new Error(`${f}: ${imp}`);
  return imp;
};

// wer in diesem Repo committet hat; ohne git (eine Kopie ohne .git) bleibt die Liste leer, die übrigen Muster gelten trotzdem
const autoren = (): string[] => {
  const r = Bun.spawnSync(["git", "-C", import.meta.dir, "log", "-500", "--format=%an"]);
  return r.exitCode === 0 ? [...new Set(r.stdout.toString().split("\n").map((x) => x.trim()).filter((x) => x.length >= 2))] : [];
};
const PRIVAT: [string, RegExp][] = [
  ["ein Pfad auf einem Rechner", /\/Users\/|\/home\/|\/private\/|\/tmp\/|~\/|[A-Z]:\\/],
  ["ein Rechnername", /someone|workhorse|tailscale|\.ts\.net|\.local\b/i],
  ["eine IP-Adresse", /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ["ein Token im Text", /token=|Bearer\s+\S|x-fleet-self-token:\s*[0-9a-f]|FLEET_[A-Z_]*TOKEN=/i],
  ["ein Wert in Token-Form (32 Hex wie ein Self-Token)", /\b[0-9a-f]{32}\b/],
  ["eine Mail-Adresse", /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
];

describe("eine Aufgaben-Datei geht in eine frische Fleet", () => {
  test("es gibt die Datei des ersten Laufs und die von Schritt 4", () => {
    expect(DATEIEN).toEqual(["postfach-pruefung.fleet.json", "sicherheitspruefung.fleet.json"]);
  });
  test.each(DATEIEN)("%s: importiert, mit Aufgabe und Prüfregel", async (f) => {
    const roh = JSON.parse(await lies(f));
    const { k } = await frisch(f);
    expect(k.aufgabe).toEqual(roh.aufgabe);
    expect(k.aufgabe?.fertig?.length ?? 0).toBeGreaterThan(20);
    expect(k.protokoll?.regel?.length ?? 0).toBeGreaterThan(20);
  });
  test.each(DATEIEN)("%s: jeder Sitz reist mit Harness und Modell, und wer von einem anderen gestartet wird, mit seinem Start", async (f) => {
    const { k, neueProfile } = await frisch(f);
    for (const x of alle(k.wurzeln)) {
      const p = neueProfile.find((q) => q.id === x.profil);
      expect([x.id, p?.agent, typeof p?.modell]).toEqual([x.id, "claude", "string"]);
    }
    for (const x of alle(k.wurzeln).filter((x) => !k.wurzeln.includes(x))) expect([x.id, (x.datei?.abschnitte.length ?? 0) > 0]).toEqual([x.id, true]);
  });
  test("der Lauf vom 21.10. nennt die Fassung, die mit ihm reist, und eine andere Fleet rechnet dieselbe nach", async () => {
    const imp = await frisch("postfach-pruefung.fleet.json");
    expect(imp.laeufe.length).toBe(1);
    expect(imp.laeufe[0]?.fassung).toBe(fassungsHash(form(imp.k, [...PROFILE0, ...imp.neueProfile])));
    expect(imp.laeufe[0]?.befunde.map((b) => b.urteil)).toEqual(["bestaetigt", "plausibel", "nicht verfolgt"]);
    expect(imp.laeufe[0]?.sitze.map((s) => [s.pos, s.ablehnungen])).toEqual([["beweiser", []], ["finder", []]]);
    expect(imp.hinweise).toContain("ein Lauf reist als Bericht mit, nur zum Lesen");
  });
  test.each(DATEIEN)("%s: kein Token, kein privater Pfad, kein Rechnername, kein Personenname", async (f) => {
    const text = await lies(f);
    for (const [was, muster] of PRIVAT) expect([was, muster.exec(text)?.[0] ?? null]).toEqual([was, null]);
    for (const name of autoren()) expect([name, new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)]).toEqual([name, false]);
    const autor = [...text.matchAll(/"autor": "([^"]*)"/g)].map((m) => m[1]);
    expect(new Set(autor)).toEqual(new Set(["du"]));
  });
});

describe("eine schiefe Aufgabe oder ein schiefer Lauf wird mit einem Satz abgelehnt", () => {
  const mit = async (aendere: (o: Record<string, unknown>) => void) => {
    const o = JSON.parse(await lies("postfach-pruefung.fleet.json"));
    aendere(o);
    return importKonst(JSON.stringify(o), PROFILE0, 7);
  };
  test("eine Aufgabe ohne Ziel", async () => {
    expect(await mit((o) => { o.aufgabe = { fertig: "x" }; })).toBe("die Aufgabe passt nicht: eine Aufgabe braucht ein Ziel");
  });
  test("eine Aufgabe mit fremdem Feld", async () => {
    expect(await mit((o) => { o.aufgabe = { ziel: "x", farbe: "rot" }; })).toBe("die Aufgabe passt nicht: aufgabe kennt kein Feld „farbe“");
  });
  test("ein Lauf ohne Fassung", async () => {
    expect(await mit((o) => { (o.laeufe as Record<string, unknown>[])[0]!.fassung = "abc"; })).toBe("Lauf 1 nennt keine Fassung (sha256 der Konstellation)");
  });
  test("ein Lauf, der eine Position nennt, die es nicht gibt", async () => {
    expect(await mit((o) => { ((o.laeufe as Record<string, unknown>[])[0]!.sitze as Record<string, unknown>[])[0]!.pos = "dritter"; }))
      .toBe("Lauf 1 nennt „dritter“, das keine Position dieser Konstellation ist");
  });
  test("ein Befund mit fremdem Urteil", async () => {
    expect(await mit((o) => { ((o.laeufe as Record<string, unknown>[])[0]!.befunde as Record<string, unknown>[])[0]!.urteil = "sicher"; }))
      .toBe("Lauf 1 hat einen Befund ohne titel, beleg oder gültiges urteil");
  });
  test("laeufe ist keine Liste", async () => {
    expect(await mit((o) => { o.laeufe = {}; })).toBe("laeufe ist eine Liste");
  });
});

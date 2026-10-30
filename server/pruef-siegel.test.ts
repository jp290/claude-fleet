// Prüf-Gedächtnis (server/pruef-siegel.ts) gegen ECHTES git in einem Temp-Ordner: zwei „Maschinen“ (zwei Klone) und ein Bare-Hub.
// Die Sätze des Owners als git-Fakten: derselbe Baum wird nur einmal geprüft, auch wenn ein Squash-Land einen neuen Commit daraus macht;
// ein geänderter Baum läuft neu; ein rotes Siegel erfüllt nichts; ein Urteil reist nie; die zweite Maschine liest „[Zitat entfernt]“.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baumVon, deckung, geforderteUnits, geprueftAm, holeSiegel, leseSiegel, planFuer, pushSiegel, schreibeSiegel,
  siegelAusZeile, vergesseAbruf, type Siegel } from "./pruef-siegel";

const base = realpathSync(mkdtempSync(join(tmpdir(), "fleet-siegel-")));
afterAll(() => rmSync(base, { recursive: true, force: true }));
const ID = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"];
const sh = (dir: string, ...a: string[]): string => {
  const p = Bun.spawnSync(["git", "-C", dir, ...a], { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${p.stderr.toString()}`);
  return p.stdout.toString().trim();
};
const commit = (dir: string, file: string, text: string): string => {
  writeFileSync(join(dir, file), text);
  sh(dir, "add", file);
  sh(dir, ...ID, "commit", "-qm", `edit ${file}`);
  return sh(dir, "rev-parse", "HEAD");
};

// der Hub und zwei Klone: „wh“ landet, „mac“ folgt
const hub = join(base, "hub.git");
mkdirSync(hub);
sh(hub, "init", "-q", "--bare", "-b", "main");
const wh = join(base, "wh"), mac = join(base, "mac");
sh(base, "clone", "-q", hub, wh);
sh(base, "clone", "-q", hub, mac);
commit(wh, "a.txt", "eins\n");
sh(wh, "push", "-q", "origin", "main");
sh(mac, "fetch", "-q", "origin");
sh(mac, "merge", "-q", "--ff-only", "origin/main");

const ALLE = geforderteUnits();
const OHNE_DOM = geforderteUnits(["dom"]);
const siegel = (tree: string, o: Partial<Siegel> = {}): Siegel => ({ v: 1, tree, units: OHNE_DOM, tiefe: "audit", ergebnis: "green",
  maschine: "wh", plattform: { os: "linux", arch: "x64", bun: "1.3.0" }, lauf: "1029-aaaa", at: 1000, ...o });

describe("Siegel am Baum, über den Hub", () => {
  test("ein Squash-Land mit gleichem Baum behält das Siegel; ein geänderter Baum nicht", async () => {
    const tip = sh(wh, "rev-parse", "HEAD");
    const tree = (await baumVon(wh, tip))!;
    expect(await schreibeSiegel(wh, siegel(tree), "wh")).toBe(true);
    // derselbe Baum unter einem neuen Commit (so sieht ein Squash-Land aus)
    sh(wh, ...ID, "commit", "-q", "--allow-empty", "-m", "squash");
    const squash = sh(wh, "rev-parse", "HEAD");
    expect(squash).not.toBe(tip);
    expect(await baumVon(wh, squash)).toBe(tree);
    expect((await planFuer(wh, squash, OHNE_DOM)).luecke).toEqual([]);
    // ein anderer Baum: alles ist Lücke
    const geaendert = commit(wh, "a.txt", "zwei\n");
    const neu = await planFuer(wh, geaendert, OHNE_DOM);
    expect(neu.tree).not.toBe(tree);
    expect(neu.gedeckt).toEqual([]);
    expect(neu.luecke).toEqual(OHNE_DOM);
  });

  test("die zweite Maschine liest das Siegel erst, wenn es über den Hub kam, und sagt „geprüft am <Rechner>, <Tiefe>“", async () => {
    const tree = (await baumVon(wh, "HEAD~1"))!;
    // vor dem Push sieht der Mac nichts
    expect((await leseSiegel(mac, tree)).length).toBe(0);
    expect(await pushSiegel(wh, "origin", "wh")).toBe(true);
    vergesseAbruf();
    expect(await holeSiegel(mac, "origin", 0)).toBe(true);
    // der Mac hat den Baum noch nicht als Commit; er braucht ihn nur als Objekt, also holt er main
    sh(wh, "push", "-q", "origin", "main");
    sh(mac, "fetch", "-q", "origin");
    const sehen = deckung(await leseSiegel(mac, tree), OHNE_DOM);
    expect(sehen.luecke).toEqual([]);
    expect(sehen.quellen.map((q) => q.maschine)).toEqual(["wh"]);
    expect(geprueftAm(sehen.quellen)).toContain("geprüft am wh, voller Audit");
    expect(geprueftAm(sehen.quellen)).toContain("1029-aaaa");
  });

  test("„fremd“ liest nur, was ein anderer Schreiber in den Hub legte, nicht den Abruf des eigenen Refs", async () => {
    const tree = (await baumVon(wh, "HEAD~1"))!;
    // der Mac hat den WH-Ref abgerufen: für den Mac ist das Siegel fremd, für den WH nicht (der Hub gibt dem WH seinen eigenen Ref zurück)
    expect((await leseSiegel(mac, tree, { fremdFuer: "mac" })).map((s) => s.maschine)).toEqual(["wh"]);
    vergesseAbruf();
    await holeSiegel(wh, "origin", 0);
    expect(await leseSiegel(wh, tree, { fremdFuer: "wh" })).toEqual([]);
    expect((await leseSiegel(wh, tree)).length).toBe(1);
  });

  test("der Abruf überschreibt nichts: der eigene Ref bleibt, der Hub-Stand liegt daneben", async () => {
    const own = sh(mac, "for-each-ref", "--format=%(refname)", "refs/notes/fleet/seal/");
    expect(own).toBe("");
    expect(sh(mac, "for-each-ref", "--format=%(refname)", "refs/notes/fleet/seal-hub/")).toBe("refs/notes/fleet/seal-hub/wh");
  });
});

describe("Deckung", () => {
  const T = "a".repeat(40);
  test("ein Check deckt seine Units; dom bleibt die Lücke, bis ein Audit es fährt", () => {
    const check = siegel(T, { tiefe: "check", maschine: "mac", units: OHNE_DOM.filter((u) => u !== "lanes"), at: 1 });
    const d = deckung([check], ALLE);
    expect(d.luecke.sort()).toEqual(["dom", "lanes"]);
    const rest = deckung([check, siegel(T, { units: ["lanes", "dom"], at: 2, lauf: "x" })], ALLE);
    expect(rest.luecke).toEqual([]);
    expect(rest.quellen.map((q) => `${q.maschine}:${q.tiefe}`)).toEqual(["mac:check", "wh:audit"]);
  });
  test("ein rotes Siegel erfüllt nichts, und ein neueres Rot hebt ein älteres Grün auf", () => {
    expect(deckung([siegel(T, { ergebnis: "red" })], OHNE_DOM).gedeckt).toEqual([]);
    const d = deckung([siegel(T, { at: 1 }), siegel(T, { at: 2, units: ["core"], ergebnis: "red", lauf: "r" })], OHNE_DOM);
    expect(d.luecke).toEqual(["core"]);
    // ein neueres Grün macht die Unit wieder gedeckt
    expect(deckung([siegel(T, { at: 1, units: ["core"], ergebnis: "red" }), siegel(T, { at: 2, units: ["core"], lauf: "g" })], ["core"]).luecke).toEqual([]);
  });
  test("ein Urteil reist nie: ein unbekanntes Feld fällt beim Lesen weg, Unlesbares ist null", () => {
    const line = JSON.stringify({ ...siegel(T), adjudication: { verdict: "flake" }, verdict: "flake" });
    const s = siegelAusZeile(line)!;
    expect(Object.keys(s).sort()).toEqual(["at", "ergebnis", "lauf", "maschine", "plattform", "tiefe", "tree", "units", "v"]);
    expect(siegelAusZeile("kein json")).toBeNull();
    expect(siegelAusZeile(JSON.stringify({ ...siegel(T), tree: "xyz" }))).toBeNull();
    expect(siegelAusZeile(JSON.stringify({ ...siegel(T), units: ["../etc"] }))).toBeNull();
    expect(siegelAusZeile(JSON.stringify({ ...siegel(T), ergebnis: "ok" }))).toBeNull();
  });
  test("ohne lesbaren Baum ist alles Lücke", async () => {
    const p = await planFuer(wh, "deadbeef".repeat(5), ["core"]);
    expect(p.tree).toBeNull();
    expect(p.luecke).toEqual(["core"]);
  });
});

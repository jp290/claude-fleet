// DIE TÜREN DES SITZES UND DER PACK, DER SIE NENNT (Richtung Schritt 1, Owner-Ja 2026-10-26). Der Test liest die
// /api/self-Türen aus server.ts — die wörtlichen Vergleiche und die Muster mit Parameter — und verlangt, dass jede
// in docs/packs/fleet-doors.md steht. Eine neue Tür ohne ihren Satz im Pack macht diesen Test rot und nennt die Tür.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nachfolgeSteineBlock } from "./selbst-einrichten";
import { gegenVorgaengerin, type Fassung } from "../src/start-brief";

const ROOT = join(import.meta.dir, "..");
const SERVER = readFileSync(join(ROOT, "server.ts"), "utf8");
const PACK = readFileSync(join(ROOT, "docs/packs/fleet-doors.md"), "utf8");
const REGISTER = JSON.parse(readFileSync(join(ROOT, ".fleet/context-packs.json"), "utf8")) as { id: string; triggers: string[];
  sources: { id?: string; path: string; anchor: string; sorte?: string; positions?: Record<string, string> }[]; estimatedBytes: number }[];

/** Ein Muster mit Parametern als die Pfade, die ein Sitz erreichen kann. Gruppen werden zu `<id>`; eine optionale
 *  Gruppe steht einmal mit und einmal ohne ihren Teil da; eine Alternation wird zu je einem Pfad. */
export function tuerFormen(muster: string): string[] {
  const s = muster.replace(/^\^/, "").replace(/\$$/, "").replace(/\\\//g, "/");
  const gruppe = /\((?:\?:)?([^()]*)\)(\?)?/.exec(s);
  if (!gruppe) return [s];
  const vor = s.slice(0, gruppe.index), nach = s.slice(gruppe.index + gruppe[0].length);
  const innen = gruppe[1] ?? "", optional = gruppe[2] === "?";
  const varianten = optional ? [vor + nach] : [];
  if (!optional && !innen.includes("|")) varianten.push(vor + "<id>" + nach);
  if (optional) varianten.push(vor + innen + nach);
  if (innen.includes("|")) for (const teil of innen.split("|")) varianten.push(vor + teil + nach);
  return varianten.flatMap(tuerFormen);
}

/** Die Türen, die server.ts unter /api/self nennt: jedes wörtliche Pfadstück und jedes Muster, das gegen
 *  url.pathname läuft. Muster werden zu erreichbaren Formen, wörtliche Pfade bleiben wie sie sind. */
export function tuerenAusServer(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/"(\/api\/self\/[^"]*)"/g)) out.add(m[1]!);
  for (const zeile of text.split("\n")) {
    if (!/(?:exec|test)\(url\.pathname\)/.test(zeile) || !zeile.includes("\\/api\\/self\\/")) continue;
    const m = /\/(\^\\\/api\\\/self\\\/.*?)\/[a-z]*\.(?:exec|test)\(url\.pathname\)/.exec(zeile);
    if (!m) continue;
    for (const form of tuerFormen(m[1]!)) out.add(form);
  }
  return out;
}

/** Die Pfade, die der Pack in seinen `…`-Stücken nennt, mit derselben Form für Parameter. */
export function tuerenAusPack(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    for (const wort of m[1]!.split(/\s+/)) {
      const pfad = wort.replace(/[.,;:]$/, "");
      if (!pfad.startsWith("/api/self/")) continue;
      out.add(pfad.replace(/<[^>]+>/g, "<id>"));
    }
  }
  return out;
}

describe("der Pack nennt jede Selbst-Tür aus server.ts", () => {
  test("keine Tür fehlt — der Fehler nennt sie", () => {
    const tueren = tuerenAusServer(SERVER), imPack = tuerenAusPack(PACK);
    const fehlt = [...tueren].filter((tuer) => !imPack.has(tuer)).sort();
    expect(fehlt).toEqual([]);
  });
  test("die Zerlegung selbst hält die Fälle, für die sie da ist: wörtlich, Parameter, optional, Alternation", () => {
    expect(tuerenAusServer('if (url.pathname === "/api/self/branch" && req.method === "GET") {}'))
      .toEqual(new Set(["/api/self/branch"]));
    expect(tuerenAusServer("const m = /^\\/api\\/self\\/context\\/([^/]+)$/.exec(url.pathname);"))
      .toEqual(new Set(["/api/self/context/<id>"]));
    expect(tuerFormen("^\\/api\\/self\\/kanten(?:\\/([0-9a-f]{16}))?$"))
      .toEqual(["/api/self/kanten", "/api/self/kanten/<id>"]);
    expect(tuerFormen("^\\/api\\/self\\/fleet-report\\/([0-9a-f]{24})\\/(accept|reject)$"))
      .toEqual(["/api/self/fleet-report/<id>/accept", "/api/self/fleet-report/<id>/reject"]);
    expect(tuerenAusPack("`GET /api/self/context/<konzept>`")).toEqual(new Set(["/api/self/context/<id>"]));
  });
});

describe("ein Stein im Startbrief ist genau eine + Zeile", () => {
  test("Zweck und Pack der Vorgängerin, jeder mit seinem Autor", () => {
    const block = nachfolgeSteineBlock([{ id: null, text: "PURPOSE (written for you by your predecessor in this slot):\nDu baust." },
      { id: "fleet-doors", text: "# Fleet's doors\n\nRead this when you call a door." }]);
    expect(block).toContain("+ purpose (author: your predecessor in this slot)");
    expect(block).toContain("+ context pack fleet-doors (author: your predecessor in this slot)");
    expect(block!.split("\n").filter((zeile) => zeile.startsWith("+ ")).length).toBe(2);
    expect(block).toContain("Du baust.");
    expect(block).toContain("Read this when you call a door.");
  });
});

describe("der gewählte Tür-Pack steht im Startbrief als ein + Teil", () => {
  const mit = `--- fleet-doors (docs/packs/fleet-doors.md · # Fleet's doors · author: your predecessor in this slot) ---\n# Fleet's doors\n\nRead this when you call a door.`;
  const f = (pack: string | null): Fassung => ({ teile: [{ id: "liest", abschnitte: pack ? [{ id: "wissen", text: pack }] : [] }] });
  test("gegenüber der Vorgängerin genau ein Part, und er ist ein +", () => {
    const neu = gegenVorgaengerin(f(mit), f(null), "");
    expect(neu.filter((b) => b.key === "pack:fleet-doors").length).toBe(1);
    expect(neu.find((b) => b.key === "pack:fleet-doors")).toMatchObject({ zeichen: "+", wer: "Your predecessor" });
  });
});

describe("der Tür-Pack ist im Register und an jedem Sitz wählbar", () => {
  test("seat-choice, eine Quelle, die exakte Größe", () => {
    const eintrag = REGISTER.find((e) => e.id === "fleet-doors");
    expect(eintrag).toBeTruthy();
    expect(eintrag!.triggers).toEqual(["seat-choice"]);
    expect(eintrag!.sources).toEqual([{ id: "fleet-doors.text", path: "docs/packs/fleet-doors.md", anchor: "# Fleet's doors", sorte: "anleitung",
      positions: { lane: "ausleihe", main: "ausleihe", orchestratorin: "ausleihe" } }]);
    expect(eintrag!.estimatedBytes).toBe(Buffer.byteLength(PACK));
  });
});

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

// DAS RECHT JE TÜR (F3 Ziel 5): die Tabelle des Packs nennt je Tür „right `x`“ oder nur das Self-Token; server.ts fragt es mit verlangeRecht. Beide
// müssen dasselbe sagen — sonst weiß ein Agent mit dem Pack nicht, was ihm fehlt, oder sucht ein Recht, das die Tür nicht verlangt.
export interface RechtsAufruf { zeile: number; rechte: string[]; pfade: string[]; paare: [pfad: string, recht: string][] }
export interface PackZeile { pfade: string[]; rechte: string[] }

/** Der Pfad in der Form des Packs: `${id}` und `<x>` als ganzes Pfadstück werden `<id>`; ein Stück mit eingesetztem Teil (program-${x}) gilt nicht. */
const pfadForm = (roh: string): string | null => {
  const pfad = roh.replace(/^(GET|POST|DELETE|PUT|PATCH)\s+/, "").replace(/[.,;:]$/, "");
  if (!pfad.startsWith("/api/self/")) return null;
  const stuecke = pfad.split("/").map((t) => /^(\$\{[^}]*\}|<[^>]+>)$/.test(t) ? "<id>" : t);
  return stuecke.some((t) => t.includes("${") || (t.includes("<") && t !== "<id>")) ? null : stuecke.join("/");
};

/** Jeder verlangeRecht-Aufruf in server.ts: seine Rechte (die Zeichenketten der Form `a.b` im zweiten Argument, auch hinter einem `?`) und die Pfade,
 *  die er schützt — die im dritten Argument, sonst die der Bedingung, die den Block öffnet (wörtliche Vergleiche und Muster, auch durch eine Konstante). */
export function rechtsAufrufe(text: string): RechtsAufruf[] {
  const zeilen = text.split("\n"), out: RechtsAufruf[] = [];
  const muster = (name: string, ab: number): string[] => {
    for (let i = ab; i >= 0; i--) {
      const m = new RegExp(`const ${name} = /(\\^.*)/[a-z]*\\.(?:exec|test)\\(url\\.pathname\\)`).exec(zeilen[i]!);
      if (m) return tuerFormen(m[1]!);
    }
    return [];
  };
  zeilen.forEach((zeile, i) => {
    if (!zeile.includes("verlangeRecht(") || /RECHT_WAS|function verlangeRecht/.test(zeile)) return;
    // die ganze Anweisung: weiter bis die Klammern des Aufrufs geschlossen sind
    let anweisung = zeile.slice(zeile.indexOf("verlangeRecht(")), tiefe = 0;
    for (let k = i; k < Math.min(i + 6, zeilen.length); k++) {
      if (k > i) anweisung += " " + zeilen[k]!.trim();
      tiefe = [...anweisung].reduce((d, c) => d + (c === "(" ? 1 : c === ")" ? -1 : 0), 0);
      if (tiefe <= 0) break;
    }
    const rechte = [...anweisung.matchAll(/"([a-z]+\.[a-z.]+)"/g)].map((x) => x[1]!);
    if (!rechte.length) return;
    // der Pfad im Aufruf: ein eingesetztes ${…} als ganzes Pfadstück wird <id>; sonst gilt das wörtliche Stück davor
    const roh = /["`](?:(?:GET|POST|DELETE) |\$\{req\.method\} )(\/api\/self\/[^"`]*)["`]/.exec(anweisung.replace(/\$\{req\.method\}/g, "POST").replace(/\$\{[^}]*\}/g, (x) => x.includes("?") ? "" : "<id>"))?.[1];
    let pfade = roh ? [pfadForm(roh.trim().replace(/\/$/, ""))].filter((p): p is string => p !== null) : [];
    if (!pfade.length) {
      // die Bedingungen der Blöcke, in denen der Aufruf steht: jedes umschließende `if (` mit kleinerer Einrückung, bis zum Kopf des Handlers
      let einzug = /^\s*/.exec(zeile)![0].length;
      for (let k = i - 1; k > Math.max(0, i - 120) && einzug > 4; k--) {
        const ein = /^\s*/.exec(zeilen[k]!)![0].length;
        if (ein >= einzug || !/^\s*(?:\} else )?if \(/.test(zeilen[k]!)) continue;
        einzug = ein;
        const bedingung: string[] = [];
        for (let j = k; j < i; j++) { bedingung.push(zeilen[j]!); if (/\{\s*$/.test(zeilen[j]!)) break; }
        const kopf = bedingung.join(" ");
        for (const w of kopf.matchAll(/url\.pathname === "(\/api\/self\/[^"]*)"/g)) pfade.push(w[1]!);
        for (const w of kopf.matchAll(/\b(self[A-Za-z]+|programTextDoor)\b/g)) pfade.push(...muster(w[1]!, k));
      }
    }
    pfade = [...new Set(pfade)];
    // die Wahl im Ausdruck („Bedingung ? "recht" : …“): jedes Recht gilt den Pfaden seiner Bedingung, das letzte den übrigen; eine Bedingung mit
    // `req.method === "GET"` gilt nur für diese Methode, der Pfad bleibt darum auch bei den übrigen
    const paare: [string, string][] = [];
    if (rechte.length === 1) pfade.forEach((p) => paare.push([p, rechte[0]!]));
    else {
      const ausdruck = anweisung.slice(anweisung.indexOf(",") + 1).replace(/^\s*\w+,\s*/, "");
      // (Pfad, nur für GET?) je Pfad der Bedingung; ein Muster aus einer Konstante gilt für jede Methode
      const bedingungPfade = (c: string): [string, boolean][] => [...c.matchAll(/(req\.method === "GET" && )?url\.pathname === "(\/api\/self\/[^"]*)"/g)]
        .map((w): [string, boolean] => [w[2]!, !!w[1]]).concat([...c.matchAll(/\b(self[A-Za-z]+)\b/g)].flatMap((w) => muster(w[1]!, i).map((p): [string, boolean] => [p, false])));
      let rest = ausdruck;
      const vergeben = new Set<string>();
      for (let m = /^(.*?) \? "([a-z]+\.[a-z.]+)" : (.*)$/.exec(rest); m; m = /^(.*?) \? "([a-z]+\.[a-z.]+)" : (.*)$/.exec(rest)) {
        for (const [p, nurGet] of bedingungPfade(m[1]!)) { paare.push([p, m[2]!]); if (!nurGet) vergeben.add(p); }
        rest = m[3]!;
      }
      const letzte = /^"([a-z]+\.[a-z.]+)"/.exec(rest.trim())?.[1];
      if (letzte) for (const p of pfade) if (!vergeben.has(p)) paare.push([p, letzte]);
    }
    out.push({ zeile: i + 1, rechte, pfade, paare });
  });
  return out;
}

/** Die Zeilen der Tabellen des Packs: die Pfade der ersten Zelle und die Rechte, die die dritte nennt („right `x`“ oder „rights `x`, `y`“). */
export function packZeilen(text: string): PackZeile[] {
  return text.split("\n").filter((z) => z.startsWith("| `")).map((z) => {
    const zellen = z.split(/(?<!\\)\|/).map((c) => c.trim());
    const pfade = [...(zellen[1] ?? "").matchAll(/`([^`]+)`/g)].flatMap((m) => m[1]!.split(/\s+/).map(pfadForm).filter((p): p is string => p !== null));
    const rechte = [...(zellen[3] ?? "").matchAll(/`([a-z]+\.[a-z.]+)`/g)].map((m) => m[1]!);
    return { pfade, rechte };
  }).filter((r) => r.pfade.length);
}

describe("das Recht jeder Tür im Pack ist das, was server.ts verlangt", () => {
  const aufrufe = rechtsAufrufe(SERVER).filter((a) => a.pfade.length), zeilen = packZeilen(PACK);
  const rechteDes = (pfad: string): Set<string> => new Set(zeilen.filter((z) => z.pfade.includes(pfad)).flatMap((z) => z.rechte));
  test("die Auslese findet die Aufrufe der Selbst-Türen (nicht null, jeder mit Pfad)", () => {
    expect(aufrufe.length).toBeGreaterThanOrEqual(17);
    expect(rechtsAufrufe(SERVER).filter((a) => !a.pfade.length && /api\/self/.test(SERVER.split("\n")[a.zeile - 1]!)).map((a) => a.zeile)).toEqual([]);
  });
  test("jedes Recht, das ein Aufruf für eine Tür verlangt, steht in der Zeile des Packs für diese Tür", () => {
    // je Paar (Tür, Recht), das ein Aufruf fragt: die Zeilen des Packs für diese Tür nennen das Recht
    const falsch = aufrufe.flatMap((a) => a.paare.flatMap(([pfad, recht]) => zeilen.some((z) => z.pfade.includes(pfad)) && !rechteDes(pfad).has(recht)
      ? [`${pfad} (server.ts:${a.zeile} fragt ${recht}; der Pack nennt ${[...rechteDes(pfad)].join(", ") || "nur das Self-Token"})`] : []));
    expect(falsch).toEqual([]);
  });
  test("jedes Recht, das der Pack einer Tür gibt, fragt irgendein Aufruf für sie; „nur das Self-Token“ heißt: kein Aufruf", () => {
    const falsch = zeilen.flatMap((z) => {
      const aufrufeDerZeile = aufrufe.filter((a) => a.pfade.some((p) => z.pfade.includes(p)));
      const gefragt = new Set(aufrufeDerZeile.flatMap((a) => a.rechte));
      const fehlend = z.rechte.filter((r) => !gefragt.has(r));
      // ein Pfad, der in mehreren Zeilen steht (GET und POST derselben Tür), wird nur über die Zeile mit Recht geprüft
      const geteilt = z.pfade.some((p) => zeilen.some((x) => x !== z && x.pfade.includes(p)));
      const ohne = !z.rechte.length && !geteilt && aufrufeDerZeile.length ? [`${z.pfade[0]}: der Pack sagt „nur Self-Token“, server.ts fragt ${[...gefragt].join(", ")}`] : [];
      return [...fehlend.map((r) => `${z.pfade[0]}: der Pack nennt ${r}, kein verlangeRecht dieser Tür fragt es`), ...ohne];
    });
    expect(falsch).toEqual([]);
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

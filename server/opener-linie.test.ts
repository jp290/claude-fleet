// DIE LINIE IM DATENSATZ DER ÖFFNERIN (server/opener.ts): wer die Öffnerin ist, entscheidet ihre Linie; ein Datensatz von vor der Linie
// liest sich wie bisher nach Platz und Ordner, und beim Laden bekommt er die Linie, wenn die Öffnerin nachweislich in ihr steht.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RechtId } from "../session-rechte";
import { openedBy, restoreBook, setOpener } from "./branches";
import { endeteLinienGeladen, fortgesetzteLinie, gleicheOeffnerin, istOeffnerin, linieEndet, linieFuerAltenOeffner, openerGeladen, openerVon,
  type EndeteLinie } from "./opener";
import { rolleFormen, sitzGegenseite } from "./selbst-sitze";

const L1 = "a".repeat(24), L2 = "b".repeat(24);

describe("die Linie der Öffnerin", () => {
  test("die Öffnung schreibt die Linie der Öffnerin in den Datensatz", () => {
    const slots = [{ id: 6, cwd: "/w/orch", openedAt: 600, linie: L1 }, { id: 8, cwd: "/w/neu", openedAt: 800, linie: L2 }];
    expect(openerVon({ kind: "owner", via: "bearer", session: { kind: "session", slot: 6, openedAt: 600, role: "generic", label: "" } }, slots, slots[1]!))
      .toEqual({ slot: 6, openedAt: 600, cwd: "/w/orch", linie: L1 });
  });

  test("ein Datensatz mit Linie: ihre Nachfolgerin ist die Öffnerin, eine fremde Session im selben Platz und Ordner nicht", () => {
    const rec = { slot: 1, openedAt: 100, cwd: "/w", linie: L1 };
    expect(istOeffnerin({ slot: 1, cwd: "/w", linie: L1 }, rec)).toBe(true);   // die Nachfolgerin (andere Belegung, dieselbe Linie)
    expect(istOeffnerin({ slot: 1, cwd: "/w", linie: L2 }, rec)).toBe(false);  // die Fremde
    expect(istOeffnerin({ slot: 2, cwd: "/w", linie: L1 }, rec)).toBe(true);   // ein anderer Platz, dieselbe Linie (eine fortgesetzte Orchestratorin)
    expect(istOeffnerin({ slot: 1, cwd: null, linie: L1 }, rec)).toBe(false);  // ein leerer Platz
  });

  test("ein alter Datensatz ohne Linie lädt und findet seine Öffnerin weiter nach Platz und Ordner", () => {
    const alt = openerGeladen({ slot: 1, openedAt: 100, cwd: "/w" });
    expect(alt).toEqual({ slot: 1, openedAt: 100, cwd: "/w" });
    expect(istOeffnerin({ slot: 1, cwd: "/w", linie: L2 }, alt)).toBe(true);
    expect(istOeffnerin({ slot: 1, cwd: "/anders", linie: L2 }, alt)).toBe(false);
    // eine Linie, die keine ist, fällt allein weg
    expect(openerGeladen({ slot: 1, openedAt: 100, cwd: "/w", linie: "x" })).toEqual({ slot: 1, openedAt: 100, cwd: "/w" });
    expect(openerGeladen({ slot: 1, openedAt: 100, cwd: "/w", linie: L1 })?.linie).toBe(L1);
  });

  test("beim Laden bekommt ein alter Datensatz die Linie, wenn die Öffnerin der heutige Besetzer ist oder einer seiner Vorgänger — sonst bleibt er", () => {
    const alt = { slot: 1, openedAt: 100, cwd: "/w" };
    expect(linieFuerAltenOeffner(alt, { id: 1, cwd: "/w", openedAt: 100, linie: L1 }, []).linie).toBe(L1);
    expect(linieFuerAltenOeffner(alt, { id: 1, cwd: "/w", openedAt: 300, linie: L1 }, [100, 200]).linie).toBe(L1);
    expect(linieFuerAltenOeffner(alt, { id: 1, cwd: "/w", openedAt: 300, linie: L1 }, [200])).toEqual(alt);
    expect(linieFuerAltenOeffner(alt, { id: 1, cwd: "/anders", openedAt: 100, linie: L1 }, [])).toEqual(alt);
    expect(linieFuerAltenOeffner(alt, undefined, [])).toEqual(alt);
  });
});

describe("eine Wahrheit über die Linie: Paar, Branch-Buch, Bildnerin", () => {
  const lead = { slot: 1, openedAt: 100, cwd: "/w", linie: L1 };
  type Rec = { slot: number; openedAt: number; cwd: string; linie?: string };
  const sitz = (slot: number, cwd: string, linie: string, openedBy: Rec | null) => ({ slot, openedAt: slot * 10, cwd, linie, openedBy, rolleStein: null });

  test("das Postfach-Paar: Öffnerin und Kind und Geschwister nach der Linie, eine Fremde im selben Platz und Ordner nicht", () => {
    const erbin = sitz(1, "/w", L1, null), fremde = sitz(1, "/w", L2, null);
    const kind = sitz(2, "/k", "c".repeat(24), lead), geschwister = sitz(3, "/g", "d".repeat(24), { ...lead, openedAt: 150 });
    expect([sitzGegenseite(erbin, kind), sitzGegenseite(kind, erbin), sitzGegenseite(kind, geschwister)]).toEqual([true, true, true]);
    expect([sitzGegenseite(fremde, kind), sitzGegenseite(kind, fremde)]).toEqual([false, false]);
    // ein alter Datensatz ohne Linie bleibt bei Platz und Ordner
    const altKind = sitz(4, "/a", "e".repeat(24), { slot: 1, openedAt: 100, cwd: "/w" });
    expect(sitzGegenseite(fremde, altKind)).toBe(true);
    expect(gleicheOeffnerin(altKind.openedBy, kind.openedBy)).toBe(true);
  });

  test("das Branch-Buch nennt die Linie seiner Öffnerin; ein alter Eintrag gilt nach Slot und Ordner", () => {
    const book = setOpener(setOpener([], "/r", "a", { slot: 1, cwd: "/w", linie: L1, at: 1 }).book, "/r", "b", { slot: 1, cwd: "/w", at: 2 }).book;
    expect(restoreBook(JSON.parse(JSON.stringify(book))).map((r) => r.opener?.linie ?? null).sort()).toEqual([L1, null].sort());
    expect(openedBy(book, { slot: 1, cwd: "/w", linie: L1 }).map((r) => r.branch).sort()).toEqual(["a", "b"]);
    expect(openedBy(book, { slot: 1, cwd: "/w", linie: L2 }).map((r) => r.branch)).toEqual(["b"]);
  });

  test("eine gebildete Rolle bildet nur die Linie ihrer Bildnerin neu", () => {
    const dir = mkdtempSync(join(tmpdir(), "linie-rolle-"));
    try {
      const wirksam = new Set<RechtId>(["text.pack"]), nie = () => false;
      const von = { text: "the session in slot 1", slot: 1, cwd: "/w", linie: L1 };
      expect(rolleFormen({ name: "Prüfer", text: "Eins." }, wirksam, dir, nie, von).ok).toBe(true);
      expect(rolleFormen({ name: "Prüfer", text: "Zwei." }, wirksam, dir, nie, { ...von, text: "the session in slot 1 (successor)" }).ok).toBe(true);
      expect(rolleFormen({ name: "Prüfer", text: "Drei." }, wirksam, dir, nie, { ...von, linie: L2 })).toMatchObject({ ok: false, status: 409 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("die Linien, die endeten (Prüfung L3)", () => {
  const e = (linie: string, o: Partial<EndeteLinie> = {}): EndeteLinie => ({ linie, slot: 6, cwd: "/w", sessionId: null, orchestrator: false, at: 1, ...o });
  test("eine Orchestratorin setzt die jüngste beendete Orchestratorin fort, ein Fortsetzen des Gesprächs dessen Linie; eine lebende Linie nie", () => {
    const liste = [e(L1, { orchestrator: true }), e(L2, { sessionId: "s-1" }), e("c".repeat(24), { orchestrator: true, at: 2 })];
    expect(fortgesetzteLinie(liste, { orchestrator: true }, new Set())).toBe("c".repeat(24));
    expect(fortgesetzteLinie(liste, { orchestrator: true }, new Set(["c".repeat(24)]))).toBe(L1);
    expect(fortgesetzteLinie(liste, { sessionId: "s-1" }, new Set())).toBe(L2);
    expect(fortgesetzteLinie(liste, { sessionId: "s-2" }, new Set())).toBeNull();
    expect(linieEndet(liste, e(L1, { at: 9 })).map((x) => x.linie)).toEqual([L2, "c".repeat(24), L1]);
    expect(endeteLinienGeladen(JSON.parse(JSON.stringify([...liste, { linie: "x" }])))).toEqual(liste);
  });
});

// PRÜFUNG RUNDE 2, N2: nach 50 anderen Enden (Lanes, Kinder, Nachfolgen) bleibt die Linie der jüngsten Orchestratorin fortsetzbar, auch über einen
// Neustart (fleet.json); eine Linie, die wieder lebt, steht nicht mehr als beendet da.
describe("die Kappe der beendeten Linien (Prüfung Runde 2, N2)", () => {
  const e = (linie: string, o: Partial<EndeteLinie> = {}): EndeteLinie => ({ linie, slot: 6, cwd: "/w", sessionId: null, orchestrator: false, at: 1, ...o });
  const andere = (n: number) => Array.from({ length: n }, (_, i) => e(i.toString(16).padStart(24, "0"), { at: 10 + i }));
  test("die jüngste Orchestratorin fällt nicht unter die Kappe, eine ältere schon", () => {
    let liste: EndeteLinie[] = [e(L2, { orchestrator: true }), e(L1, { orchestrator: true, at: 2 })];
    for (const x of andere(60)) liste = linieEndet(liste, x);
    expect(fortgesetzteLinie(liste, { orchestrator: true }, new Set())).toBe(L1);
    expect(liste.some((x) => x.linie === L2)).toBe(false);
    expect(fortgesetzteLinie(endeteLinienGeladen(JSON.parse(JSON.stringify(liste))), { orchestrator: true }, new Set())).toBe(L1);
    expect(fortgesetzteLinie(endeteLinienGeladen([e(L1, { orchestrator: true }), ...andere(60)]), { orchestrator: true }, new Set())).toBe(L1);
  });
});

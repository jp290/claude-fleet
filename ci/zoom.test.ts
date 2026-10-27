// Die eigenen px einer Spalte, die mit dem Fenster zoomt (e2e/zoom.ts): Leiste und Infospalte tragen
// --rail-scale (src/rails.ts) und die Infospalte zusätzlich --board-scale (src/board.ts#fitBoardZoom),
// also antwortet jedes getBoundingClientRect darin in FENSTER-px. Am 27.10. war darum das Post-Land-
// Audit von main rot: bei 1200 px steht die Leiste auf 0.8, der 8 × 8-Punkt maß 6.4, die 28-px-Zeile
// 22.4, und der Text der Zeichnung 9.6 gegen Infos 12 — auf jedem Rechner, nicht auf einem.
import { describe, expect, test } from "bun:test";
import { railScale } from "../src/rails";
import { SNAP_PX, ownPx, zoomOf } from "../e2e/zoom";

describe("eine Länge aus einer gezoomten Spalte", () => {
  test("die DOM-Rigs stehen bei 1200 px auf dem Anteil 0.8 der Leiste", () => {
    // die Zahl, aus der die drei Maße unten kommen: 1200/1800 = 0.667, gehalten auf RAIL_MIN 0.8
    expect(railScale(1200)).toBe(0.8);
    expect(railScale(1440)).toBe(0.8);
    expect(railScale(1800)).toBe(1);
    expect(railScale(390)).toBe(0.8); // das Telefon schaltet den Zoom per Media Query ab, nicht über den Anteil
  });
  test("wird in den px gelesen, die das Stylesheet zeichnet", () => {
    expect(ownPx(6.4, 0.8)).toBeCloseTo(8, 9); // der Punkt, den .slot .act mit 8 × 8 zeichnet
    expect(Math.round(ownPx(22.4, 0.8))).toBe(28); // die Zeile, die --b-fold mit 28 zeichnet
    expect(ownPx(28, 1)).toBe(28); // das Telefon schaltet den Zoom ab: unverändert
    expect(ownPx(0, 0)).toBe(0); // ein unlesbarer Zoom teilt nicht durch null
  });

  test("misst ihren Zoom am Element selbst, nicht an einer CSS-Variable", () => {
    // das Telefon setzt zoom: 1 in einer Media Query, während --rail-scale 0.8 bleibt: eine Ableitung
    // aus der Variablen wäre dort falsch, ein Maß am Element nicht
    let removed = false;
    const host = { appendChild: () => undefined };
    const doc = { createElement: () => ({ style: { cssText: "" }, getBoundingClientRect: () => ({ width: 80 }), remove: () => { removed = true; } }) };
    const gauge = (document: unknown, e: unknown): number => new Function("document", "e", `return ${zoomOf("e")}`)(document, e) as number;
    expect(gauge(doc, host)).toBeCloseTo(0.8, 9);
    expect(removed).toBe(true); // die Sonde räumt sich selbst weg
    expect(gauge(doc, null)).toBe(1); // kein Host: kein Zoom
  });

  test("nimmt die Rundung des Fensters und bleibt dabei scharf", () => {
    // was das Fenster für den 8 × 8-Punkt der Leiste bei 1200 px meldet: 6.390625 statt 6.4 (Layout-Einheit 1/64)
    const glyph = ownPx(6.390625, 0.8);
    expect(glyph).toBeCloseTo(7.98828125, 9);
    expect(Math.abs(glyph - 8) <= SNAP_PX).toBe(true);
    // ein wirklich anders gezeichneter Punkt bleibt rot: 7 px und 9 px sind je eine ganze Zahl daneben
    expect(Math.abs(ownPx(5.6, 0.8) - 8) <= SNAP_PX).toBe(false);
    expect(Math.abs(ownPx(7.2, 0.8) - 8) <= SNAP_PX).toBe(false);
  });

  test("eine Blocklinie zählt, wie die Seite sie malt", () => {
    // Chromium zeichnet keine Haarline dünner als ein Geräte-px: 1 px in einer 0.8-Spalte wird mit 1.25 benutzt,
    // mal dem Zoom ist das das eine px, das ein Mensch sieht; das eigene border-top: 0 der Checks bleibt 0
    const painted = (width: number, zoom: number) => Math.round(width * zoom * 100) / 100;
    expect(painted(1.25, 0.8)).toBe(1);
    expect(painted(0, 0.8)).toBe(0);
    expect(painted(2.5, 0.8)).toBe(2); // eine geänderte, dickere Linie bleibt sichtbar — die Umrechnung versteckt nichts
  });

  test("ein Popover misst seine Breite in den px der Spalte", () => {
    // das Menü zeichnet 210 px; bei 1200 sind das 168 Fenster-px, und die 200 der Gestaltung sind Spalten-px
    const fits = (width: number, zoom: number) => width / zoom >= 200;
    expect(fits(168, 0.8)).toBe(true);
    expect(fits(177, 0.8)).toBe(true);
    expect(fits(168, 1)).toBe(false); // roh gelesen fiele dasselbe Menü durch — das war der Fehler
  });

  test("lässt die Prüfung scharf: eine wirklich skalierte Zeichnung bleibt rot", () => {
    const info = 12, zoom = 0.8; // Infos font-size und der Zoom der Spalte
    const drawn = (fontPx: number, scale: number) => ownPx(fontPx * scale, zoom);
    expect(Math.abs(drawn(12, zoom) - info)).toBeLessThan(0.05); // so breit wie ihr viewBox: Infos Größe
    expect(Math.abs(drawn(12, zoom * 0.5) - info)).toBeGreaterThan(0.05); // auf die halbe Spalte geschrumpft
  });
});

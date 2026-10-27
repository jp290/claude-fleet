// THE SIDE COLUMNS' OWN PX. `#side` and `#boardbody` are zoomed with the window (public/index.html,
// --rail-scale from src/rails.ts, and the Info column on top of it from src/board.ts#fitBoardZoom).
// Every getBoundingClientRect inside them therefore answers in WINDOW px, while the stylesheet's
// numbers — a fold 28 px, a state glyph 8 × 8, the drawing's words "as large as Info's" — are the px
// it draws. A check that compares the two without the zoom reads a correct page as broken: on
// 27.10. main's post-land audit was red with 36 + 1 + 1 such claims, at 1200 px, where the rail's
// share is 1200/1800 held up to 0.8 and the glyphs therefore measured 6.4 against 8 and the folds
// 22 against 28. Nothing about it was the machine's: the zoom depends on window.innerWidth alone.
//
// e2e/leiste.ts already divides by --rail-scale (it was taught that in the same commit that added the
// zoom, eb4adc58). This module is the same idea for the new callers, plus ONE difference: it measures
// the zoom ON THE PAGE instead of re-deriving it from the stylesheet, because the phone's media query
// turns it off again (`@media (max-width: 700px) … #shell-board #board #boardbody { zoom: 1 }` and
// `#side { zoom: 1 }`). A reader of --rail-scale would divide there and be wrong exactly where the
// layout is right.

/** Page source: the zoom the element `expr` names sits under (1 when there is none). */
export const zoomOf = (expr: string): string => `(() => { const host = ${expr}; if (!host) return 1;
  const g = document.createElement('div');
  g.style.cssText = 'position:absolute;left:-9999px;top:0;width:100px;height:100px;pointer-events:none';
  host.appendChild(g); const z = g.getBoundingClientRect().width / 100; g.remove(); return z > 0 ? z : 1; })()`;

/** A length the page reported in window px, as the px the stylesheet drew — the column's own px. */
export const ownPx = (length: number, zoom: number): number => length / (zoom > 0 ? zoom : 1);

/**
 * How far two lengths in a column's own px may sit apart and still be the same drawn length.
 * The window snaps a zoomed rect to its layout unit (1/64 px) before getBoundingClientRect reports it — the bar's
 * 8 px glyph comes back as 6.390625, not 6.4 — and dividing by the smallest zoom (RAIL_MIN 0.8) widens that to
 * 0.0195 px at most. 0.05 is two and a half of that: it takes the rounding and keeps the edge, because a glyph drawn
 * at 7 or 9 px is a whole px off (ci/zoom.test.ts holds both sides).
 */
export const SNAP_PX = 0.05;

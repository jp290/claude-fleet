// THE SIDE COLUMNS' SIZE (owner 25.10.: on the workhorse board the bar and Info are „[Zitat entfernt]“,
// on the Mac board „[Zitat entfernt]“ — one browser, two addresses). A browser remembers its zoom per address, and a window the
// zoom makes wider holds the same px columns in less of the screen. So the columns do not hold px: they hold a share of the window.
// --rail-scale multiplies the bar (#side) and the info column (#board); the page's own px stay what they were designed in (the
// bar 288, Info 336), and the scale is the window's width over RAIL_WINDOW, held between RAIL_MIN and RAIL_MAX. On the owner's
// 1470-point screen that is the same size at any browser zoom, between the two pictures (about 0.8 of the old default).
// The text sliders do not reach the bar (public/index.html, #side); Info follows "Oberfläche" on top of it (board.ts#fitBoardZoom).
export const RAIL_WINDOW = 1800;
export const RAIL_MIN = 0.8;
export const RAIL_MAX = 1.25;

export const railScale = (width: number): number =>
  Math.round(Math.min(RAIL_MAX, Math.max(RAIL_MIN, width / RAIL_WINDOW)) * 1000) / 1000;

const listeners = new Set<() => void>();
export function onRailScale(fn: () => void): void { listeners.add(fn); }

let current = 0;
export const currentRailScale = (): number => current || railScale(window.innerWidth);

function apply(): void {
  const next = railScale(window.innerWidth);
  if (next === current) return;
  current = next;
  document.documentElement.style.setProperty("--rail-scale", String(next));
  for (const l of listeners) l();
}

export function initRails(): void {
  apply();
  window.addEventListener("resize", apply);
}

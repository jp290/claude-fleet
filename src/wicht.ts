// THE WICHTE ON THE INPUT FIELD (owner 25.10.: „[Zitat entfernt]“
// ). While a subagent of the focused session runs,
// a little snow wicht hops on the input block's top edge, one per subagent: it comes when the subagent starts and
// goes when it is done. Whether the session itself works, the status line says (src/livestate.ts); a command in
// the background gets no wicht. The count is the focused pane's live state (server/live-state.ts,
// `background.agents`) while that pane shows its chat view. With reduced motion they sit still. aria-hidden: the
// status line (role=status) says „arbeitet im Hintergrund“.
import type { LiveState } from "./livestate";

// one per subagent; more than this would crowd the edge, and they come back as the others finish
const MOST = 8;
export function wichteOf(s: Partial<Pick<LiveState, "background">> | null): number {
  return Math.min(MOST, Math.max(0, s?.background?.agents ?? 0));
}

const CSS = `
#wichtseat { position: absolute; left: 0; top: 0; width: 100%; height: 0; pointer-events: none; z-index: 2; }
#wichtseat > .wichte { position: absolute; display: flex; align-items: flex-end; gap: 5px; line-height: 0; transform: translateY(-100%); }
.wichte svg { display: block; overflow: visible; transform-origin: 50% 100%; }
.wichte .wb, .wichte .wo { transform-box: fill-box; }
.wichte .wb { transform-origin: 50% 100%; animation: wicht-hop .7s cubic-bezier(.4,0,.3,1) infinite; }
.wichte .wo { transform-origin: 50% 50%; animation: wicht-blink 5.5s infinite; }
.wichte .kommt { animation: wicht-kommt .36s cubic-bezier(.2,.7,.2,1) both; }
.wichte .geht { animation: wicht-geht .3s ease-in both; }
@keyframes wicht-hop { 0% { transform: scale(1.07,.9); } 28% { transform: translateY(-6px) scale(.94,1.07); }
  50% { transform: translateY(-8px) scale(1,1); } 78% { transform: translateY(0) scale(1.09,.88); } 100% { transform: scale(1.07,.9); } }
@keyframes wicht-blink { 0%, 93%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(.1); } }
@keyframes wicht-kommt { from { opacity: 0; transform: translateY(8px) scale(.5); } to { opacity: 1; transform: none; } }
@keyframes wicht-geht { to { opacity: 0; transform: translateY(-6px) scale(.7); } }
@media (prefers-reduced-motion: reduce) { .wichte, .wichte * { animation: none !important; } }
`;

// the drawing, node by node: no HTML sink in the client (fleet-e2e-security.ts §7), as in src/icons.ts
const NS = "http://www.w3.org/2000/svg";
function s(tag: string, attrs: Record<string, string | number> = {}, ...kids: SVGElement[]): SVGElement {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  n.append(...kids);
  return n;
}
let uid = 0;
const INK = "#0b0b0c";
// a soft snow blob with a glint, two eyes that blink and a small open mouth
function wicht(size: number): SVGElement {
  const id = `wicht${++uid}`;
  const eye = (x: number) => [s("ellipse", { cx: x, cy: 23, rx: 2.5, ry: 4.2, fill: INK }),
    s("circle", { cx: x + 0.9, cy: 21.1, r: 0.95, fill: "#fff" })];
  return s("svg", { width: size, height: (size * 40) / 48, viewBox: "0 0 48 40" },
    s("defs", {}, s("radialGradient", { id, cx: 0.36, cy: 0.3, r: 0.85 },
      s("stop", { offset: 0, "stop-color": "#ffffff" }), s("stop", { offset: 0.55, "stop-color": "#ececf0" }),
      s("stop", { offset: 1, "stop-color": "#b4b7c2" }))),
    s("g", { class: "wb" },
      s("path", { d: "M4 31C4 15 13 6 24 6S44 15 44 31C44 37.5 36 40 24 40S4 37.5 4 31Z", fill: `url(#${id})` }),
      s("ellipse", { cx: 15, cy: 14, rx: 4.2, ry: 2.3, fill: "#fff", transform: "rotate(-32 15 14)" }),
      s("g", { class: "wo" }, ...eye(19), ...eye(29)),
      s("ellipse", { cx: 24, cy: 31, rx: 1.7, ry: 2, fill: "#2a1d1d" })));
}

let seat: HTMLElement | null = null;
let row: HTMLElement | null = null;
let drawnSize = 0;
let onPhone = false;
// the seat is a layer in the band (#bar, positioned while the chat view shows): it takes no room in the
// composer's own layout, whose gaps differ between the desk and the phone
function rowIn(bar: HTMLElement): HTMLElement {
  if (row) return row;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  seat = document.createElement("div");
  seat.id = "wichtseat";
  seat.setAttribute("aria-hidden", "true");
  row = document.createElement("div");
  row.className = "wichte";
  seat.appendChild(row);
  bar.prepend(seat);
  const again = new ResizeObserver(() => place());
  for (const id of ["bar", "comp", "compsurface"]) { const n = document.getElementById(id); if (n) again.observe(n); }
  return row;
}
const paints = (n: Element): boolean => {
  const cs = getComputedStyle(n);
  return parseFloat(cs.borderTopWidth) > 0 || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor);
};
// the top of what the eye reads as the input block's upper edge: the first box from the field outward that
// paints one (the field's own surface at the desk, the island on the phone), raised over whatever stands above
// the field in the band — a hint line, the chips, the key row a touch screen shows at the desk layout (the iPad)
// — so a wicht never sits on a key
function edgeTop(): number | null {
  const surface = document.getElementById("compsurface"), comp = document.getElementById("comp");
  if (!surface || !comp) return null;
  let top = surface.getBoundingClientRect().top;
  for (let n: HTMLElement | null = surface; n; n = n.parentElement) {
    if (paints(n)) { top = n.getBoundingClientRect().top; break; }
    if (n.id === "bar") break;
  }
  const above = (parent: Element, before: Element) => {
    for (const k of parent.children) {
      if (k === before) break;
      // in the flow only: the phone's grip hangs over the island's edge on its own
      if (k === seat || !(k instanceof HTMLElement) || k.offsetHeight === 0 || /^(absolute|fixed)$/.test(getComputedStyle(k).position)) continue;
      top = Math.min(top, k.getBoundingClientRect().top);
    }
  };
  above(comp, surface);
  if (comp.parentElement) above(comp.parentElement, comp);
  return top;
}
// where they sit, measured on every sync and whenever the band or the composer change size: at the left of the
// composer's column (a centred column inside the band at the desk, the whole island on the phone), 1 px into the edge
function place(): void {
  const comp = document.getElementById("comp");
  if (!seat || !row || !comp || row.childElementCount === 0) return;
  const edge = edgeTop();
  if (edge === null) return;
  const st = seat.getBoundingClientRect(), c = comp.getBoundingClientRect();
  const y = `${Math.round(edge - st.top + 1)}px`, x = `${Math.round(c.left - st.left + (onPhone ? 16 : 22))}px`;
  if (row.style.top !== y) row.style.top = y;
  if (row.style.left !== x) row.style.left = x;
}
function leave(w: Element): void {
  w.classList.remove("kommt");
  w.classList.add("geht");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { w.remove(); return; }
  w.addEventListener("animationend", (e) => { if (e.target === w) w.remove(); });
  setTimeout(() => w.remove(), 600);
}

// the focused pane's live state as its chat view shows it (null: another view, a past session, not read yet)
export function syncWichte(live: LiveState | null, phone: boolean): void {
  const bar = document.getElementById("bar");
  if (!bar) return;
  const r = rowIn(bar);
  const want = wichteOf(live);
  const size = phone ? 24 : 26;
  onPhone = phone;
  let staying = [...r.children].filter((n) => !n.classList.contains("geht"));
  // another size (the phone turned, the window crossed the phone width): the same wichte, redrawn without coming
  if (size !== drawnSize) {
    drawnSize = size;
    r.replaceChildren(...staying.map(() => wicht(size)));
    staying = [...r.children];
  }
  for (let i = staying.length; i < want; i++) {
    const w = wicht(size);
    // each hops a little after its neighbour
    (w.querySelector(".wb") as SVGElement).style.animationDelay = `${-((i * 0.23) % 0.7)}s`;
    w.classList.add("kommt");
    r.appendChild(w);
  }
  for (let i = staying.length; i > want; i--) leave(staying[i - 1]!);
  place();
}

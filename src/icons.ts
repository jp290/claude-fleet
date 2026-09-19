// The composer's icon set, in the board's existing grammar (client.ts#PK_ICONS: 24-unit box,
// stroke 1.8, round caps and joins, currentColor) — built node by node with createElementNS, so
// no markup string ever reaches a sink (the md.ts rule; fleet-e2e-security.ts §7).
const NS = "http://www.w3.org/2000/svg";

const PATHS = {
  plus: ["M12 5v14", "M5 12h14"],
  send: ["M12 19V6", "M6 11l6-6 6 6"],
  chevron: ["M7 10l5 5 5-5"],
  x: ["M7 7l10 10", "M17 7L7 17"],
  folder: ["M3 7a2 2 0 0 1 2-2h3.2l1.8 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  file: ["M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z", "M13.5 3v5.5H19"],
  image: ["M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M4 16l4.5-4.5 4 4 2.5-2.5 5 5", "M15.5 9.5h.01"],
  history: ["M3.5 12a8.5 8.5 0 1 0 2.5-6", "M3.5 4v4h4", "M12 7.5v4.7l3 1.8"],
  clock: ["M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0z", "M12 7.5v4.7l3 1.8"],
  spark: ["M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.9z", "M18.5 16v4", "M16.5 18h4"],
  keys: ["M3 6.5h18v11H3z", "M7 10h.01", "M10.3 10h.01", "M13.7 10h.01", "M17 10h.01", "M8 14h8"],
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ico");
  for (const d of PATHS[name]) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

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

// ONE MARK PER AGENT HARNESS — each is the sign the CLI itself paints at the top of its own
// session (owner, tenth cut: "soweit möglich einfach die echten"), rebuilt here from what the
// installed package draws, never a downloaded logo file:
//   claude  the block mascot of the Claude Code banner, in the colour the CLI calls clawd_body
//           (rgb(215,119,87)); the three rows below are the banner's quadrant glyphs
//   codex   ">_", the prefix of the "OpenAI Codex" header line in its TUI
//   pi      the bold app name "pi" its interactive header prints, in the dark theme's accent
//           (#8abeb7, modes/interactive/theme/dark.json)
// A quadrant glyph is half a cell wide and half a cell high, so one glyph = 2×2 pixels of 1×2
// units (a terminal cell is twice as tall as wide).
const CLAWD = [" ▐▛███▜▌ ", "▝▜█████▛▘", "  ▘▘ ▝▝  "];
const QUADS: Record<string, [number, number, number, number]> = { // upper-left, upper-right, lower-left, lower-right
  "▐": [0, 1, 0, 1], "▌": [1, 0, 1, 0], "▛": [1, 1, 1, 0], "▜": [1, 1, 0, 1],
  "▝": [0, 1, 0, 0], "▘": [1, 0, 0, 0], "█": [1, 1, 1, 1],
};
function clawd(): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${CLAWD[1].length * 2} ${CLAWD.length * 4}`);
  svg.setAttribute("fill", "#d77757");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("mark", "clawd");
  CLAWD.forEach((row, r) => [...row].forEach((ch, c) => {
    const q = QUADS[ch];
    if (!q) return;
    q.forEach((on, i) => {
      if (!on) return;
      const px = document.createElementNS(NS, "rect");
      px.setAttribute("x", String(c * 2 + (i % 2)));
      px.setAttribute("y", String(r * 4 + (i < 2 ? 0 : 2)));
      px.setAttribute("width", "1.04"); // the overlap closes hairline seams between pixels
      px.setAttribute("height", "2.04");
      svg.appendChild(px);
    });
  }));
  return svg;
}
function wordMark(text: string, cls: string): HTMLElement {
  const e = document.createElement("span");
  e.className = `mark ${cls}`;
  e.setAttribute("aria-hidden", "true");
  e.textContent = text;
  return e;
}

// the mark for a harness id (GET /api/harnesses), or null — an unknown harness shows no mark
export function harnessMark(id: string): Element | null {
  if (id === "claude") return clawd();
  if (id === "codex") return wordMark(">_", "codexmark");
  if (id === "pi" || id.startsWith("pi-")) return wordMark("pi", "pimark");
  return null;
}

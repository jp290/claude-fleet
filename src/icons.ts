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
  // the clockwise twin of history's sweep, without the clock hands — the Files block's re-read
  reload: ["M20.5 12a8.5 8.5 0 1 1-2.5-6", "M20.5 4v4h-4"],
  clock: ["M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0z", "M12 7.5v4.7l3 1.8"],
  keys: ["M3 6.5h18v11H3z", "M7 10h.01", "M10.3 10h.01", "M13.7 10h.01", "M17 10h.01", "M8 14h8"],
  // THE HEAD ROW'S SET (#sidetools). Same 24-unit box, stroke 1.8, currentColor as everything
  // above, so an icon row in the bar and the tray under the composer read as one grammar.
  list: ["M4 7h3", "M4 12h3", "M4 17h3", "M10 7h10", "M10 12h10", "M10 17h10"],
  megaphone: ["M4 10v4a1 1 0 0 0 1 1h3l6 4V5L8 9H5a1 1 0 0 0-1 1z", "M17.5 9a4 4 0 0 1 0 6"],
  inbox: ["M4 13h4l1.5 3h5L16 13h4", "M4 13l2.5-7.5h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"],
  shield: ["M12 3.5l7 2.5v5.5c0 4-3 7-7 9-4-2-7-5-7-9V6z"],
  receipt: ["M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z", "M9 8h6", "M9 12h6"],
  laptop: ["M5.5 6h13v9h-13z", "M3 18.5h18"],
  saver: ["M12 20a8 8 0 1 1 8-8", "M12 12l4.5-3.5", "M12 20v.01"],
  dots: ["M6 12h.01", "M12 12h.01", "M18 12h.01"],
  // the four views, each drawn as the arrangement it makes — all in the same 16-unit square, so the
  // single view IS a square (owner 2026-09-21) and the others read as that square divided
  view1: ["M4 4h16v16H4z"],
  view2: ["M4 4h16v16H4z", "M12 4v16"],
  view3: ["M4 4h16v16H4z", "M11 4v16", "M11 12h9"],
  view4: ["M4 4h16v16H4z", "M12 4v16", "M4 12h16"],
  // the computers a fleet runs on: one screen, and two overlapping — the second says "more than one"
  screen: ["M4 5h16v11H4z", "M9 20h6", "M12 16v4"],
  screens: ["M8 9V4h13v9h-5", "M3 9h13v9H3z", "M7.5 21h4", "M9.5 18v3"],
  // THE PANE'S CORNER GROUP (Grammatik K4/G0.6): the six emoji/unicode glyphs ↻ ℹ 💬 ↑ ↓ migrate
  // here — ↻ reuses reload, the keyboard is the terminal side of the view toggle — plus the gear
  // (settings, rightmost, G5) and the width arrows (terminal on the chat column's width). Same
  // 24-unit box, stroke 1.8, round caps, currentColor as every set above.
  info: ["M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0z", "M12 11v5", "M12 7.6h.01"],
  chat: ["M21 14a2 2 0 0 1-2 2H8l-4.5 4V6a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2z"],
  up: ["M12 19V5", "M6 11l6-6 6 6"],
  down: ["M12 5v14", "M6 13l6 6 6-6"],
  gear: ["M12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8", "M12 2.8v2.6", "M12 18.6v2.6", "M2.8 12h2.6",
    "M18.6 12h2.6", "M5.5 5.5l1.8 1.8", "M16.7 16.7l1.8 1.8", "M18.5 5.5l-1.8 1.8", "M7.3 16.7l-1.8 1.8"],
  width: ["M3.5 12h17", "M7.5 8l-4 4 4 4", "M16.5 8l4 4-4 4"],
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

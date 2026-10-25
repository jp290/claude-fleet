// THE SESSION MARK in the left bar — Fassung B, "Zweig", the one the owner chose (2026-09-29, queue
// review question 4: „[Zitat entfernt]“). Ported from the design page
// docs/design/sidebar/marken5.js (Fassung B only); what it shows and how it measured is
// docs/messungen/2026-09-25-session-marke-runde-5.md.
//
// A growth rule per species, drawn with the turtle (frond, tier, fork, arc), and the wind runs as a
// wave from the root into the tips. Every means carries exactly one fact:
//
//   species      = repo      the index of the project hue — species and colour are the SAME fact, so
//                            the project stays readable without colour, and two repos share a
//                            species exactly when they already share a hue (§F2)
//   growth       = role      how many plants, how big: single · group of three · pair · crouched · small
//   bud          = harness   a bud on every tip (claude) · bare tips (codex) · forked tips (pi)
//   specimen     = session   lean, curl, fork angle from the seed
//   movement     = state     working: wind · waiting on the owner: soft wind + breathing frame ·
//                            resting: still · asleep: hangs, every second branch gone, grey ·
//                            done: no buds left · broken: trunk kinked, trembles, red
//
// The context fill is NOT on the mark (the card forbids it; the number stays in the row).
//
// DERIVED, NEVER STORED: the mark is a pure function of the facts above. The seed is FNV-1a over
// repo|harness|main-or-lane|slot|openedAt, so a restart or a rebuilt bar draws the very same plant;
// nothing is written anywhere. No Math.random, and no Math.sin/Math.cos either: ECMAScript leaves
// their precision to the engine, so the same seed would grow a different plant in V8 and in
// JavaScriptCore. dsin/dcos below use only IEEE-754-exact operations.
//
// Build shape of src/flakes.ts: ONE canvas for the whole bar, ONE requestAnimationFrame, still in a
// hidden tab, one still frame (never nothing) under prefers-reduced-motion. A moving cell is cleared
// and redrawn each frame, a standing one once — so rest needs no trick.

const PI = 3.141592653589793, TWO_PI = 6.283185307179586;

// --- the project hue: ONE identity, the bar's own ----------------------------------------------
// Eight hues, not a continuum — the reasoning (near-misses are worse than collisions) sits at
// src/client.ts#projectHue's call site. It lives here so the mark's species and the row's tint are
// computed by the same function; client.ts imports it.
export const PROJECT_HUES = [8, 45, 88, 135, 175, 205, 260, 315];
export function projectHue(path: string): number {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return PROJECT_HUES[(h >>> 0) % PROJECT_HUES.length];
}

// --- seed, random stream, sine --------------------------------------------------------------------
export function seedOf(f: { repo: string; harness: string; lane: boolean; slot: number; openedAt: number }): number {
  const s = `${f.repo}|${f.harness}|${f.lane ? "lane" : "main"}|${f.slot}|${f.openedAt}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// mulberry32 — every mark draws from its own stream, out of its own seed
function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// reduction to [-PI, PI] and a Taylor series to x^11: not more precise than Math.sin (~2e-8), but
// the same everywhere, which is what an identity needs
export function dsin(x: number): number {
  x -= TWO_PI * Math.floor((x + PI) / TWO_PI);
  const q = x * x;
  return x * (1 + q * (-1 / 6 + q * (1 / 120 + q * (-1 / 5040 + q * (1 / 362880 + q * (-1 / 39916800))))));
}
export function dcos(x: number): number { return dsin(x + 1.5707963267948966); }

const hash = (a: number, b: number): number => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

// --- the facts ----------------------------------------------------------------------------------
export type MarkRole = "main" | "orch" | "astra" | "steward" | "lane";
export type MarkState = "work" | "need" | "rest" | "done" | "sleep" | "bad";
export type MarkHarness = "claude" | "codex" | "pi";
export interface MarkFacts {
  repo: string; harness: string; role: MarkRole; slot: number; openedAt: number; state: MarkState;
}

// the slice of a sidebar row the mark reads — structural, so this module needs nothing from client.ts
export interface MarkSlot {
  id: number; label: string | null; harness?: string; model?: string | null; openedAt?: number;
  worktree?: unknown; awaiting?: "owner" | "main";
  git?: { dirty: number; ahead: number } | null;
}

// the same role words the server keys off (server.ts#isOrchestratorLabel, STEWARD_LABEL)
const ORCHESTRATOR_LABEL_RE = /(^|[^\p{L}])orchestrator/iu;
const STEWARD_LABEL = "⚙ steward";

export function roleOf(s: MarkSlot): MarkRole {
  if (s.worktree) return "lane";
  if (s.label && (s.label.includes("🎛") || ORCHESTRATOR_LABEL_RE.test(s.label))) return "orch";
  if (s.label === STEWARD_LABEL) return "steward";
  if (s.model && /astra/i.test(s.model)) return "astra";
  return "main";
}

// `glyph` is the row's own state reading (src/client.ts#slotState) — the mark never reads the
// state a second way. On top of it only the two facts the glyph has no shape for: a session that
// waits on the owner (`awaiting`) and a lane whose work is committed and waits to land.
export function markFacts(s: MarkSlot, project: string, glyph: "work" | "rest" | "sleep" | "bad"): MarkFacts {
  const role = roleOf(s);
  const state: MarkState = glyph === "bad" ? "bad"
    : s.awaiting === "owner" ? "need"
    : glyph === "work" ? "work"
    : role === "lane" && s.git && s.git.dirty === 0 && s.git.ahead > 0 ? "done"
    : glyph;
  return { repo: project, harness: s.harness ?? "claude", role, slot: s.id, openedAt: s.openedAt ?? 0, state };
}

export const harnessOf = (h: string): MarkHarness =>
  h === "codex" ? "codex" : h === "pi" || h.startsWith("pi-") ? "pi" : "claude";

// --- state: what moves, and how the shape closes ------------------------------------------------
// amp = wind strength (radians over the whole axis), om = beat. `lauf` decides whether the cell is
// repainted per frame — only then does it move; everything else stands after one frame.
interface Zustand {
  lauf: boolean; amp: number; om: number; light: number;
  beacon?: boolean; verblueht?: boolean; gray?: boolean; haengt?: boolean; red?: boolean; knick?: boolean;
}
const ZUSTAND: Record<MarkState, Zustand> = {
  work:  { lauf: true,  amp: 0.30, om: 1.7, light: 64 },
  need:  { lauf: true,  amp: 0.12, om: 0.8, light: 70, beacon: true },
  rest:  { lauf: false, amp: 0,    om: 0,   light: 60 },
  done:  { lauf: false, amp: 0,    om: 0,   light: 44, verblueht: true },
  sleep: { lauf: false, amp: 0,    om: 0,   light: 48, gray: true, haengt: true },
  bad:   { lauf: true,  amp: 0.07, om: 23,  light: 62, red: true, knick: true },
};
export const moves = (state: MarkState): boolean => ZUSTAND[state].lauf;

// --- growth from the role, specimen from the seed -----------------------------------------------
// The specimen is ALWAYS rolled for three plants whatever the role, so the first plant keeps its
// lean when only the role changes.
interface Layout { bx: number; h: number; k: number }
const LAYOUT: Record<MarkRole, Layout[]> = {
  main:    [{ bx: 0.5, h: 0.84, k: 1 }],
  orch:    [{ bx: 0.5, h: 0.88, k: 0.86 }, { bx: 0.2, h: 0.52, k: 0.66 }, { bx: 0.8, h: 0.58, k: 0.66 }],
  astra:   [{ bx: 0.32, h: 0.76, k: 0.8 }, { bx: 0.68, h: 0.76, k: 0.8 }],
  steward: [{ bx: 0.5, h: 0.52, k: 1.08 }],
  lane:    [{ bx: 0.5, h: 0.58, k: 0.74 }],
};
interface Exemplar { bx: number; h: number; k: number; lean: number; curl: number; seite: number; ph: number; n: number }
function exemplare(seed: number, role: MarkRole): Exemplar[] {
  const r = rngOf(seed);
  // the draw order is the design's (lean, bxj, hj, curl, seite, ph, rot, n) — rot is unused by the
  // branch but still drawn, or every later number would shift
  const wurf = [0, 1, 2].map(() => {
    const lean = (r() - 0.5) * 0.46, bxj = (r() - 0.5) * 0.1, hj = 0.9 + r() * 0.1;
    const curl = (r() - 0.5) * 0.5, seite = r() < 0.5 ? -1 : 1, ph = r() * 6.283;
    r();
    return { lean, bxj, hj, curl, seite, ph, n: r() };
  });
  return LAYOUT[role].map((l, i) => ({
    bx: l.bx + wurf[i].bxj, h: l.h * wurf[i].hj, k: l.k,
    lean: wurf[i].lean, curl: wurf[i].curl, seite: wurf[i].seite, ph: wurf[i].ph, n: wurf[i].n,
  }));
}

// everything the painter needs, derived once per cell from the facts and the cell size
export interface MarkShape {
  s: number; seed: number; art: number; hue: number; harness: MarkHarness; state: MarkState; ex: Exemplar[];
}
export function markShape(f: MarkFacts, size: number): MarkShape {
  const seed = seedOf({ repo: f.repo, harness: f.harness, lane: f.role === "lane", slot: f.slot, openedAt: f.openedAt });
  const hue = projectHue(f.repo);
  return { s: size, seed, art: Math.max(0, PROJECT_HUES.indexOf(hue)), hue, harness: harnessOf(f.harness), state: f.state, ex: exemplare(seed, f.role) };
}

// --- Fassung B · Zweig ----------------------------------------------------------------------------
type Pen = CanvasRenderingContext2D;
type Pt = [number, number, number];
interface Cell { s: number; seed: number; t: number }

function zweigWind(c: Cell, e: Exemplar, z: Zustand, f: number): number {
  return z.lauf ? (z.amp * 0.5) * f * dsin(z.om * c.t - f * 2.4 + e.ph) : 0;
}

function achse(ctx: Pen, c: Cell, e: Exemplar, z: Zustand, x: number, y: number, a: number, L: number, n: number,
  krumm: (f: number) => number, f0 = 0, steif = 1): Pt[] {
  const pts: Pt[] = [[x, y, a]], dir = e.lean >= 0 ? 1 : -1;
  ctx.moveTo(x, y);
  for (let i = 1; i <= n; i++) {
    const f = f0 + (1 - f0) * i / n;
    a += krumm(i / n) + steif * zweigWind(c, e, z, f) * 2 / n;
    if (z.haengt && i / n > 0.4) a += dir * 0.35 * steif;
    if (z.knick && i === Math.ceil(n / 2)) a += dir * 1.0;
    x += dcos(a) * L / n; y += dsin(a) * L / n;
    ctx.lineTo(x, y); pts.push([x, y, a]);
  }
  return pts;
}

type Art = (ctx: Pen, c: Cell, e: Exemplar, z: Zustand, x: number, y: number, L: number, spitzen: Pt[], kopf: string) => void;
const ZWEIG: Art[] = [
  function farn(ctx, c, e, z, x, y, L, spitzen) {
    const n = 8, curl = (e.curl >= 0 ? 1 : -1) * 0.55;
    const ax = achse(ctx, c, e, z, x, y, -PI / 2 + e.lean, L, n, (f) => curl * f * f / 2 + e.curl / n);
    for (let i = 1; i < n; i++) {
      const [px, py, pa] = ax[i], len = L * 0.32 * (1 - i / n) + 0.6;
      for (const s of [-1, 1]) {
        if (z.haengt && (i + (s > 0 ? 1 : 0)) % 2) continue;
        ctx.moveTo(px, py); ctx.lineTo(px + dcos(pa + s * 1.1) * len, py + dsin(pa + s * 1.1) * len);
      }
    }
    spitzen.push(ax[n]);
  },
  function tanne(ctx, c, e, z, x, y, L, spitzen) {
    const n = 7, ax = achse(ctx, c, e, z, x, y, -PI / 2 + e.lean * 0.4, L, n, () => 0);
    for (let i = 1; i < n; i++) {
      const [px, py, pa] = ax[i], len = L * 0.46 * (1 - i / n) + 0.5;
      for (const s of [-1, 1]) {
        if (z.haengt && (i + (s > 0 ? 1 : 0)) % 2) continue;
        const w = pa + s * (z.haengt ? 2.3 : 1.95);
        ctx.moveTo(px, py); ctx.lineTo(px + dcos(w) * len, py + dsin(w) * len);
      }
    }
    spitzen.push(ax[n]);
  },
  function gras(ctx, c, e, z, x, y, L, spitzen) {
    for (let j = 0; j < 5; j++) {
      if (z.haengt && j % 2) continue;
      const k = j - 2, len = L * (0.6 + 0.4 * hash(j, c.seed));
      ctx.moveTo(x, y);
      const ax = achse(ctx, c, e, z, x + k * 0.6, y, -PI / 2 + e.lean + k * 0.26, len, 5, () => k * 0.07);
      spitzen.push(ax[5]);
    }
  },
  function weide(ctx, c, e, z, x, y, L, spitzen) {
    const st = achse(ctx, c, e, z, x, y, -PI / 2 + e.lean * 0.5, L * 0.46, 3, () => 0);
    const [tx, ty, ta] = st[3];
    for (let j = 0; j < 5; j++) {
      if (z.haengt && j % 2) continue;
      const k = j - 2, s = k === 0 ? e.seite : Math.sign(k);
      ctx.moveTo(tx, ty);
      const ax = achse(ctx, c, e, z, tx, ty, ta + k * 0.5, L * 0.62, 6, () => s * 0.42, 0.45);
      spitzen.push(ax[6]);
    }
  },
  function baum(ctx, c, e, z, x, y, L, spitzen) {
    const gabel = (px: number, py: number, a: number, len: number, d: number, f: number): void => {
      a += zweigWind(c, e, z, f) + (z.haengt && d < 3 ? (e.lean >= 0 ? 0.4 : -0.4) : 0);
      if (z.knick && d === 2) a += 1.0;
      const qx = px + dcos(a) * len, qy = py + dsin(a) * len;
      ctx.moveTo(px, py); ctx.lineTo(qx, qy);
      if (!d) { spitzen.push([qx, qy, a]); return; }
      const j = (hash(d, c.seed) - 0.5) * 0.3;
      gabel(qx, qy, a - 0.44 - j, len * 0.7, d - 1, f + 0.25);
      if (!(z.haengt && d === 1)) gabel(qx, qy, a + 0.44 - j, len * 0.7, d - 1, f + 0.25);
    };
    gabel(x, y, -PI / 2 + e.lean * 0.5, L * 0.34, 4, 0);
  },
  function kaktus(ctx, c, e, z, x, y, L, spitzen, kopf) {
    // the one outline: a thick line, hollowed. The cactus is stiff — the wind barely bends it
    // (steif 0.25), which is botany, not a special case. The design hollowed it with a black stroke
    // on its black page; the bar is not black, so the inner stroke CUTS the canvas instead.
    ctx.stroke(); ctx.beginPath();
    const w = c.s * 0.15 * e.k, arm: Pt[] = [];
    const ax = achse(ctx, c, e, z, x, y, -PI / 2 + e.lean * 0.2, L * 0.9, 4, () => 0, 0, 0.25);
    const s = e.seite, [ax1, ay1] = ax[2];
    const ex = ax1 + s * c.s * 0.17 * e.k, ey = ay1 - (z.haengt ? -c.s * 0.1 : c.s * 0.2) * e.k;
    ctx.moveTo(ax1, ay1); ctx.lineTo(ex, ay1); ctx.lineTo(ex, ey); arm.push([ex, ey, -PI / 2]);
    if (e.n > 0.5) {
      const [bx1, by1] = ax[3], fx = bx1 - s * c.s * 0.13 * e.k;
      ctx.moveTo(bx1, by1); ctx.lineTo(fx, by1); ctx.lineTo(fx, by1 - c.s * 0.12 * e.k); arm.push([fx, by1 - c.s * 0.12 * e.k, -PI / 2]);
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = w; ctx.strokeStyle = kopf; ctx.stroke();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = Math.max(0.6, w - 2); ctx.strokeStyle = "#000"; ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "butt"; ctx.lineJoin = "miter";
    ctx.beginPath();
    spitzen.push(ax[4], ...arm);
  },
  function bambus(ctx, c, e, z, x, y, L, spitzen) {
    for (let j = 0; j < 3; j++) {
      if (z.haengt && j === 1) continue;
      const k = j - 1, len = L * (j === 1 ? 1 : 0.78);
      ctx.moveTo(x + k * c.s * 0.1 * e.k, y);
      const ax = achse(ctx, c, e, z, x + k * c.s * 0.1 * e.k, y, -PI / 2 + e.lean * 0.6 + k * 0.1, len, 5, () => 0);
      for (let i = 1; i < 5; i++) {
        const [px, py, pa] = ax[i], t = c.s * 0.035;
        ctx.moveTo(px + dcos(pa + PI / 2) * t, py + dsin(pa + PI / 2) * t); ctx.lineTo(px - dcos(pa + PI / 2) * t, py - dsin(pa + PI / 2) * t);
      }
      const [qx, qy, qa] = ax[4], s = j % 2 ? 1 : -1;
      ctx.moveTo(qx, qy); ctx.lineTo(qx + dcos(qa + s * 0.9) * c.s * 0.2 * e.k, qy + dsin(qa + s * 0.9) * c.s * 0.2 * e.k);
      spitzen.push(ax[5]);
    }
  },
  function busch(ctx, c, e, z, x, y, L, spitzen) {
    // L-system F -> F[+F]F[-F]F, depth 2: nine segments on the main axis
    const seg = L / 9, th = 0.46;
    const F = (px: number, py: number, a: number, d: number, f: number): Pt => {
      if (!d) {
        a += zweigWind(c, e, z, f) * 0.5 + (z.haengt ? (e.lean >= 0 ? 0.12 : -0.12) : 0);
        const qx = px + dcos(a) * seg, qy = py + dsin(a) * seg;
        ctx.moveTo(px, py); ctx.lineTo(qx, qy); return [qx, qy, a];
      }
      let p = F(px, py, a, d - 1, f);
      if (!(z.haengt && d === 1)) { const b = F(p[0], p[1], p[2] + th, d - 1, f + 0.1); if (d === 1) spitzen.push(b); }
      p = F(p[0], p[1], p[2], d - 1, f + 0.1);
      const b2 = F(p[0], p[1], p[2] - th, d - 1, f + 0.2); if (d === 1) spitzen.push(b2);
      p = F(p[0], p[1], p[2], d - 1, f + 0.3);
      return p;
    };
    const end = F(x, y, -PI / 2 + e.lean * 0.6 + (z.knick ? 0.8 : 0), 2, 0);
    spitzen.push(end);
  },
];

// one hue per mark, only the lightness varies; asleep grey, broken red
function farben(hue: number, z: Zustand): { kopf: string; hell: string } {
  const h = z.red ? 2 : hue, sat = z.gray ? 0 : z.red ? 70 : 58, L = z.light;
  const c = (l: number) => `hsl(${h} ${sat}% ${Math.max(6, Math.min(94, l))}%)`;
  return { kopf: c(L + 8), hell: c(L + 18) };
}

// Paint one mark at the ORIGIN, in a box of m.s × m.s, at time t (seconds of movement). Pure: the
// same shape and t give the same drawing commands, wherever the bar puts the cell.
export function paintMark(ctx: Pen, m: MarkShape, t: number): void {
  const z = ZUSTAND[m.state], col = farben(m.hue, z), c: Cell = { s: m.s, seed: m.seed, t };
  for (const e of m.ex) {
    const x = c.s * e.bx, y = c.s - 1.5, L = c.s * e.h * 0.92, spitzen: Pt[] = [];
    ctx.beginPath();
    ZWEIG[m.art](ctx, c, e, z, x, y, L, spitzen, col.kopf);
    ctx.strokeStyle = col.kopf; ctx.lineWidth = c.s >= 40 ? 1.3 : e.k < 0.8 ? 0.7 : 0.85; ctx.stroke();
    // the buds carry the harness; done means no buds left, asleep neither
    if (z.verblueht || z.haengt || m.harness === "codex") continue;
    const r = c.s * 0.045 * e.k + 0.35;
    ctx.beginPath();
    for (const [px, py, pa] of spitzen) {
      if (m.harness === "claude") { ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 2 * PI); }
      else {
        ctx.moveTo(px, py); ctx.lineTo(px + dcos(pa - 0.6) * r * 2.4, py + dsin(pa - 0.6) * r * 2.4);
        ctx.moveTo(px, py); ctx.lineTo(px + dcos(pa + 0.6) * r * 2.4, py + dsin(pa + 0.6) * r * 2.4);
      }
    }
    if (m.harness === "claude") { ctx.fillStyle = col.hell; ctx.fill(); }
    else { ctx.strokeStyle = col.hell; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  // waiting on the owner: the breathing frame, the one state that sits on the edge
  if (z.beacon) {
    const a = 0.25 + 0.4 * (0.5 + 0.5 * dsin(t * 2.2));
    ctx.strokeStyle = `hsl(${m.hue} 58% ${z.light + 12}% / ${a})`; ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, c.s - 1.5, c.s - 1.5);
  }
}

// --- the stage: ONE canvas for the bar, ONE rAF --------------------------------------------------
// What the stage may ask of the world. The browser's answers are the default; the e2e check hands
// in its own, so "reduced motion stops every movement" is pinned without a browser.
export interface MarkEnv {
  reduce(): boolean;
  hidden(): boolean;
  raf(cb: (t: number) => void): number;
  caf(id: number): void;
  now(): number;
  listen(wake: () => void): void;
}
function browserEnv(): MarkEnv {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  return {
    reduce: () => reduce.matches,
    hidden: () => document.hidden,
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    now: () => performance.now(),
    listen: (wake) => { document.addEventListener("visibilitychange", wake); reduce.addEventListener("change", wake); },
  };
}

export interface MarkRow { x: number; y: number; size: number; facts: MarkFacts | null }
interface StageCell { x: number; y: number; s: number; t: number; key: string; shape: MarkShape | null; painted: boolean }

export class MarkStage {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly env: MarkEnv;
  private cells: StageCell[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(canvas?: HTMLCanvasElement, env?: MarkEnv) {
    this.canvas = canvas ?? document.createElement("canvas");
    this.canvas.className = "markstage";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    this.env = env ?? browserEnv();
    this.env.listen(() => this.sync());
  }

  // how many marks move right now — also on the canvas as data-moving, for the eye and the probes
  get moving(): number { return this.running() ? this.cells.filter((c) => c.shape && moves(c.shape.state)).length : 0; }

  // Place the marks. A cell whose identity AND state did not change keeps its time, so a poll that
  // rebuilds the bar does not restart the wind (no jump); anything else starts at t = 0.
  setRows(rows: MarkRow[], cssW: number, cssH: number, dpr = 1): void {
    const before = new Map(this.cells.map((c) => [c.key, c.t]));
    if (cssW !== this.w || cssH !== this.h || dpr !== this.dpr) {
      this.w = cssW; this.h = cssH; this.dpr = dpr;
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;
    }
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx?.clearRect(0, 0, cssW, cssH);
    this.cells = rows.map((r) => {
      const shape = r.facts ? markShape(r.facts, r.size) : null;
      const key = shape ? `${shape.seed}|${r.facts!.role}|${r.size}|${shape.state}` : `free|${r.x}|${r.y}`;
      return { x: r.x, y: r.y, s: r.size, t: before.get(key) ?? 0, key, shape, painted: false };
    });
    this.sync();
  }

  dispose(): void {
    this.env.caf(this.raf);
    this.raf = 0;
    this.cells = [];
  }

  private running(): boolean { return !this.env.hidden() && !this.env.reduce(); }

  sync(): void {
    this.env.caf(this.raf);
    this.raf = 0;
    for (const c of this.cells) c.painted = false;
    this.paintAll(0); // the still frame, always — also when nothing moves
    const moving = this.moving;
    this.canvas.dataset.moving = String(moving);
    if (!moving) return;
    this.last = this.env.now();
    this.raf = this.env.raf((t) => this.frame(t));
  }

  private frame(t: number): void {
    const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    this.paintAll(dt);
    this.raf = this.env.raf((n) => this.frame(n));
  }

  private paintAll(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const c of this.cells) {
      const lauf = !!c.shape && moves(c.shape.state);
      if (c.painted && !lauf) continue;
      c.painted = true;
      c.t += dt;
      ctx.save();
      ctx.beginPath(); ctx.rect(c.x, c.y, c.s, c.s); ctx.clip();
      ctx.clearRect(c.x, c.y, c.s, c.s);
      ctx.translate(c.x, c.y);
      if (c.shape) paintMark(ctx, c.shape, c.t);
      else paintFree(ctx, c.s);
      ctx.restore();
    }
  }
}

// a free place: bare soil. One line, no plant — it holds the column's axis
function paintFree(ctx: Pen, s: number): void {
  ctx.beginPath(); ctx.moveTo(s * 0.25, s - 1.5); ctx.lineTo(s * 0.75, s - 1.5);
  ctx.strokeStyle = "hsl(0 0% 26%)"; ctx.lineWidth = 1; ctx.stroke();
}

// --- the bar: measure the reserved .mark boxes and hand them to the stage -------------------------
// The canvas lives in the scrolling list, absolutely placed, so it scrolls with the rows. It is only
// as big as the marks' column (never the list's scrollHeight, which would feed back into itself).
// A box the CSS hides (collapsed rail) measures 0 and gets no cell.
export interface MarkItem { el: HTMLElement; facts: MarkFacts | null }
// The bar is zoomed (src/rails.ts, #side { zoom }): getBoundingClientRect reports zoomed px, while the canvas, scrollTop and the
// borders are in the host's own px. z is the factor between the two; every measured length is divided by it.
export interface Box { left: number; bottom: number; width: number; height: number }
export function markCell(r: Box, hr: { left: number; top: number }, scroll: { left: number; top: number }, border: { left: number; top: number }, z: number): { x: number; y: number; size: number } {
  const size = Math.round(r.width / z);
  const x = Math.round((r.left - hr.left) / z + scroll.left - border.left);
  // a free place's box is flatter than wide: the soil line sits on its bottom edge
  const y = Math.round((r.bottom - hr.top) / z + scroll.top - border.top) - size;
  return { x, y, size };
}
export function placeMarks(stage: MarkStage, host: HTMLElement, items: MarkItem[]): void {
  if (stage.canvas.parentElement !== host) host.prepend(stage.canvas);
  const hr = host.getBoundingClientRect();
  const z = host.offsetWidth ? hr.width / host.offsetWidth || 1 : 1;
  const rows: MarkRow[] = [];
  let w = 0, h = 0;
  for (const it of items) {
    const r = it.el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const { x, y, size } = markCell(r, hr, { left: host.scrollLeft, top: host.scrollTop }, { left: host.clientLeft, top: host.clientTop }, z);
    rows.push({ x, y, size, facts: it.facts });
    w = Math.max(w, x + size);
    h = Math.max(h, y + size);
  }
  stage.setRows(rows, w, h, Math.min(2, window.devicePixelRatio || 1));
}

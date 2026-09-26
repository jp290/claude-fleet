import { seedOf, rngOf, dsin, dcos } from "./marken3.js";
import { projectHue, PROJECT_HUES } from "./marken.js";
import { FASSUNGEN as ROUND5, PflanzStage, ZUSTAND as ROUND5_STATE } from "./marken5.js";

export { seedOf, projectHue };
export const ROLES = { main: "Program-MAIN", orch: "Orchestratorin", astra: "Astra", steward: "Steward", lane: "Lane" };
export const harnessOf = (h) => h === "codex" ? "codex" : h === "pi" || h?.startsWith("pi-") ? "pi" : "claude";
export const repoOf = (repo) => Math.max(0, PROJECT_HUES.indexOf(projectHue(repo ?? "")));
const PI = 3.141592653589793;
const TAU = 2 * PI;
const wave = (t, phase, speed = 4) => dsin(t * speed + phase);
const stateOf = (mark, reduced) => reduced ? "rest" : mark.state;
const colorOf = (mark) => mark.grey ? "#c8c8c8" : `hsl(${projectHue(mark.repo)} 62% 68%)`;

function line(ctx, points, width = 1.2) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.lineWidth = width; ctx.stroke();
}
function dot(ctx, x, y, r, fill = true) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) ctx.fill(); else ctx.stroke();
}

const Arm = {
  id: "arm", label: "A · Greifarm",
  layout(mark) {
    const rnd = rngOf(mark.seed), role = mark.role;
    const count = role === "orch" ? 3 : role === "astra" ? 2 : 1;
    return { phase: rnd() * TAU, lean: (rnd() - 0.5) * 0.22,
      arms: Array.from({ length: count }, (_, i) => ({
        base: (i - (count - 1) / 2) * 0.53,
        len: (role === "lane" ? 0.37 : role === "steward" ? 0.36 : 0.46) * (0.86 + rnd() * 0.18),
      })) };
  },
  draw(ctx, m, c, t, reduced) {
    const s = m.size, st = stateOf(m, reduced), repo = repoOf(m.repo);
    ctx.save(); ctx.translate(s / 2, s * 0.84); ctx.strokeStyle = colorOf(m); ctx.fillStyle = ctx.strokeStyle;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const foot = 2.4 + (repo % 3) * 0.55;
    line(ctx, [[-foot, 0], [foot, 0]], 1.6);
    line(ctx, [[-foot + repo % 2, 1.5], [foot - (repo >> 1) % 2, 1.5]], 0.9);
    if (repo & 4) dot(ctx, 0, 1.4, 0.55);
    for (const a of c.arms) {
      const reach = st === "need" ? -0.65 + 0.07 * wave(t, c.phase, 5)
        : st === "work" ? 0.46 * wave(t, c.phase, 5)
          : st === "sleep" ? 0.95 : st === "bad" ? -0.95 + 0.11 * wave(t, c.phase, 19) : 0;
      let angle = -PI / 2 + a.base + c.lean + reach;
      const x1 = dcos(angle) * s * a.len * 0.55, y1 = dsin(angle) * s * a.len * 0.55;
      angle += st === "need" ? -0.23 : st === "work" ? 0.5 * wave(t, c.phase + 1, 5) : st === "sleep" ? 0.9 : 0.13;
      const x2 = x1 + dcos(angle) * s * a.len * 0.52, y2 = y1 + dsin(angle) * s * a.len * 0.52;
      line(ctx, [[0, 0], [x1, y1], [x2, y2]], m.role === "steward" ? 2.1 : 1.3);
      if (harnessOf(m.harness) === "claude") dot(ctx, x1, y1, 1.05);
      else if (harnessOf(m.harness) === "codex") ctx.fillRect(x1 - 1, y1 - 1, 2, 2);
      else dot(ctx, x1, y1, 1.25, false);
      const open = st === "need" ? 0.72 : st === "work" ? 0.25 + 0.18 * wave(t, c.phase, 5) : 0.24;
      const grip = s * 0.16;
      line(ctx, [[x2 + dcos(angle - open) * grip, y2 + dsin(angle - open) * grip], [x2, y2],
        [x2 + dcos(angle + open) * grip, y2 + dsin(angle + open) * grip]], 1.2);
    }
    ctx.restore();
  },
};

const Arm2 = {
  id: "arm2", label: "A2 · Greifarm mit Session",
  layout(mark) {
    const r = rngOf(mark.seed), role = mark.role;
    const count = role === "orch" ? 3 : role === "astra" ? 2 : 1;
    return { phase: r() * TAU, arms: Array.from({ length: count }, (_, i) => ({
      base: (i - (count - 1) / 2) * 0.53,
      shoulder: (r() - 0.5) * 1.7,
      elbow: (r() - 0.5) * 1.9,
      length1: 0.6 + r() * 0.8,
      length2: 0.6 + r() * 0.8,
      claw: (r() - 0.5) * 1.7,
    })) };
  },
  draw(ctx, m, c, t, reduced) {
    const s = m.size, st = stateOf(m, reduced), repo = repoOf(m.repo);
    ctx.save(); ctx.translate(s / 2, s * 0.84); ctx.strokeStyle = colorOf(m); ctx.fillStyle = ctx.strokeStyle;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const foot = 2.4 + (repo % 3) * 0.55;
    line(ctx, [[-foot, 0], [foot, 0]], 1.6);
    line(ctx, [[-foot + repo % 2, 1.5], [foot - (repo >> 1) % 2, 1.5]], 0.9);
    if (repo & 4) dot(ctx, 0, 1.4, 0.55);
    for (const a of c.arms) {
      const reach = st === "need" ? -0.65 + 0.07 * wave(t, c.phase, 5)
        : st === "work" ? 0.46 * wave(t, c.phase, 5)
          : st === "sleep" ? 0.95 : st === "bad" ? -0.95 + 0.11 * wave(t, c.phase, 19) : 0;
      const len = roleLength(m.role) * s;
      let angle = -PI / 2 + a.base + a.shoulder + reach;
      const x1 = dcos(angle) * len * 0.55 * a.length1, y1 = dsin(angle) * len * 0.55 * a.length1;
      angle += a.elbow + (st === "need" ? -0.23 : st === "work" ? 0.5 * wave(t, c.phase + 1, 5) : st === "sleep" ? 0.9 : 0.13);
      const x2 = x1 + dcos(angle) * len * 0.52 * a.length2, y2 = y1 + dsin(angle) * len * 0.52 * a.length2;
      line(ctx, [[0, 0], [x1, y1], [x2, y2]], m.role === "steward" ? 2.1 : 1.3);
      if (harnessOf(m.harness) === "claude") dot(ctx, x1, y1, 1.05);
      else if (harnessOf(m.harness) === "codex") ctx.fillRect(x1 - 1, y1 - 1, 2, 2);
      else dot(ctx, x1, y1, 1.25, false);
      const open = st === "need" ? 0.72 : st === "work" ? 0.25 + 0.18 * wave(t, c.phase, 5) : 0.24;
      const grip = s * 0.16, direction = angle + a.claw;
      line(ctx, [[x2 + dcos(direction - open) * grip, y2 + dsin(direction - open) * grip], [x2, y2],
        [x2 + dcos(direction + open) * grip, y2 + dsin(direction + open) * grip]], 1.2);
    }
    ctx.restore();
  },
};
const roleLength = (role) => role === "lane" ? 0.37 : role === "steward" ? 0.36 : 0.46;

const Kamon = {
  id: "kamon", label: "C · Kamon-Kern",
  layout(mark) { const r = rngOf(mark.seed); return { phase: r() * TAU, turn: (r() - 0.5) * 0.7 }; },
  draw(ctx, m, c, t, reduced) {
    const s = m.size, st = stateOf(m, reduced), repo = repoOf(m.repo);
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(c.turn);
    ctx.strokeStyle = colorOf(m); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.35;
    const r = s * (m.role === "lane" ? 0.29 : m.role === "steward" ? 0.34 : 0.39);
    dot(ctx, 0, 0, r, false);
    const n = m.role === "orch" ? 3 : m.role === "astra" ? 2 : m.role === "steward" ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const a = -PI / 2 + i * TAU / n, rr = m.role === "steward" ? r * 0.53 : r * 0.58;
      const x = dcos(a) * rr, y = dsin(a) * rr;
      if (repo % 4 === 0) ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
      else if (repo % 4 === 1) dot(ctx, x, y, 1.6);
      else if (repo % 4 === 2) line(ctx, [[x - 1.6, y], [x, y - 1.8], [x + 1.6, y]], 1.25);
      else line(ctx, [[x - 1.6, y - 1.3], [x + 1.6, y + 1.3]], 1.4);
    }
    if (repo & 4) { line(ctx, [[-r * 0.55, r * 0.77], [r * 0.55, r * 0.77]], 0.7); }
    ctx.rotate(-c.turn);
    let x = st === "need" ? -r * 0.73 + 0.5 * wave(t, c.phase, 5)
      : st === "work" ? r * 0.67 * dcos(t * 3.4 + c.phase) : 0;
    let y = st === "work" ? r * 0.67 * dsin(t * 3.4 + c.phase) : st === "sleep" ? r * 0.55 : 0;
    if (st === "bad") { x = r * 0.78; y = 0.4 * wave(t, c.phase, 20); }
    if (harnessOf(m.harness) === "codex") ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    else if (harnessOf(m.harness) === "pi") dot(ctx, x, y, 1.8, false);
    else dot(ctx, x, y, 1.65);
    ctx.restore();
  },
};

const Lantern = {
  id: "lantern", label: "L · Laterne und Docht",
  layout(mark) { const r = rngOf(mark.seed); return { phase: r() * TAU, lean: (r() - 0.5) * 0.12 }; },
  draw(ctx, m, c, t, reduced) {
    const s = m.size, st = stateOf(m, reduced), repo = repoOf(m.repo), role = m.role;
    ctx.save(); ctx.translate(s / 2, s * 0.77); ctx.rotate(c.lean);
    ctx.strokeStyle = colorOf(m); ctx.fillStyle = ctx.strokeStyle; ctx.lineCap = "round";
    const h = role === "lane" ? s * 0.37 : role === "steward" ? s * 0.32 : s * 0.47;
    const w = role === "steward" ? s * 0.28 : role === "astra" ? s * 0.18 : s * 0.22;
    const roof = role === "orch" ? [[-w, -h], [0, -h - 3], [w, -h]]
      : role === "astra" ? [[-w, -h], [-w / 2, -h - 2], [w / 2, -h - 2], [w, -h]]
        : role === "steward" ? [[-w, -h], [w, -h]]
          : role === "lane" ? [[-w / 2, -h], [w / 2, -h]] : [[-w, -h], [0, -h - 2], [w, -h]];
    line(ctx, [[-w, 0], [-w, -h], ...roof, [w, -h], [w, 0], [-w, 0]], 1.25);
    if (role === "orch") { line(ctx, [[-w - 2, 0], [-w - 2, -h * 0.55]], 1); line(ctx, [[w + 2, 0], [w + 2, -h * 0.55]], 1); }
    if (role === "astra") line(ctx, [[0, 0], [0, -h]], 0.75);
    if (role === "steward") line(ctx, [[-w - 2, 0], [-w - 2, -h * 0.25], [w + 2, -h * 0.25], [w + 2, 0]], 1.8);
    for (let i = 1; i <= 2; i++) if ((repo >> (i - 1)) & 1) line(ctx, [[-w + 1, -h * i / 3], [w - 1, -h * i / 3]], 0.6);
    if (repo & 4) dot(ctx, w - 1.2, -h * 0.48, 0.55);
    const fx = st === "need" ? -w * 0.65 + 0.5 * wave(t, c.phase, 4)
      : st === "work" ? w * 0.27 * wave(t, c.phase, 7) : 0;
    const fh = st === "sleep" ? 1 : st === "work" ? h * (0.36 + 0.08 * wave(t, c.phase + 2, 9)) : h * 0.3;
    const fy = -h * 0.26;
    if (st === "bad") line(ctx, [[fx, fy], [fx + 2, fy - fh * 0.5], [fx - 2, fy - fh]], 1.4);
    else if (st === "sleep") dot(ctx, fx, fy, 0.9);
    else line(ctx, [[fx, fy], [fx - 1.3, fy - fh * 0.55], [fx, fy - fh], [fx + 1.3, fy - fh * 0.55], [fx, fy]], 1.2);
    if (harnessOf(m.harness) === "codex") ctx.fillRect(fx - 1, fy - 1, 2, 2);
    else if (harnessOf(m.harness) === "pi") dot(ctx, fx, fy, 1.2, false);
    ctx.restore();
  },
};

const Branch = {
  id: "branch", label: "Z · Zweig umverdrahtet",
  layout(mark) { const r = rngOf(mark.seed); return { phase: r() * TAU, lean: (r() - 0.5) * 0.45 }; },
  draw(ctx, m, c, t, reduced) {
    const s = m.size, st = stateOf(m, reduced), repo = repoOf(m.repo);
    ctx.save(); ctx.translate(s / 2, s * 0.91);
    ctx.strokeStyle = colorOf(m); ctx.fillStyle = ctx.strokeStyle; ctx.lineCap = "round";
    const h = s * (m.role === "lane" ? 0.53 : m.role === "steward" ? 0.48 : 0.77);
    const lean = c.lean + (st === "need" ? -0.55 + 0.025 * wave(t, c.phase, 4)
      : st === "work" ? 0.13 * wave(t, c.phase, 4) : st === "sleep" ? 0.45 : st === "bad" ? 0.75 : 0);
    const tip = [];
    const axis = (x, y, len, angle, depth = 0) => {
      const n = 5, pts = [[x, y]];
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        const wavePart = st === "work" ? 0.17 * f * wave(t, c.phase - f * 2.4, 4) : 0;
        const a = angle + wavePart + (st === "bad" && i > 2 ? 0.3 : 0);
        x += dcos(a) * len / n; y += dsin(a) * len / n; pts.push([x, y]);
      }
      line(ctx, pts, depth ? 0.8 : 1.25); tip.push(pts[n]); return pts;
    };
    const a = -PI / 2 + lean;
    if (m.role === "orch") {
      for (const k of [-1, 0, 1]) axis(k * s * 0.1, 0, h * (k ? 0.72 : 1), a + k * 0.24);
    } else if (m.role === "astra") {
      for (const k of [-1, 1]) axis(k * s * 0.1, 0, h * 0.88, a + k * 0.16);
    } else if (m.role === "steward") {
      for (const k of [-2, -1, 0, 1, 2]) axis(0, 0, h * (1 - Math.abs(k) * 0.16), a + k * 0.38);
    } else {
      const trunk = axis(0, 0, h, a);
      if (m.role === "main") for (let i = 1; i < 5; i++) {
        const p = trunk[i], side = i % 2 ? -1 : 1;
        const len = h * (0.42 - i * 0.05);
        axis(p[0], p[1], len, a + side * 0.9, 1);
      }
    }
    for (let i = 1; i < 5; i++) if ((repo >> ((i - 1) % 3)) & 1) {
      const y = -h * i / 5, x = dcos(a) * h * i / 5;
      line(ctx, [[x - 1.6, y], [x + 1.6, y]], 0.65);
    }
    if (st !== "sleep" && st !== "done") for (const [x, y] of tip) {
      if (harnessOf(m.harness) === "claude") dot(ctx, x, y, 1.25);
      else if (harnessOf(m.harness) === "pi") line(ctx, [[x - 1.4, y - 1.1], [x, y], [x + 1.4, y - 1.1]], 0.8);
    }
    ctx.restore();
  },
};

const round5Builder = new PflanzStage(document.createElement("canvas"));
function round5Renderer(id, label, fassung, turnToName = false) {
  return {
  id, label, control: id === "r5b",
  layout(mark) {
    return round5Builder.bau({ ...mark, x: 0, y: 0, rolle: mark.role, fassung });
  },
  draw(ctx, mark, cache, t, reduced) {
    const state = stateOf(mark, reduced), original = ROUND5_STATE[state] ?? ROUND5_STATE.rest;
    const z = turnToName && state === "need" ? { ...original, amp: 0.015, beacon: false } : original;
    cache.t = t;
    const hue = z.red ? 2 : cache.hue, sat = z.gray ? 0 : z.red ? 70 : 58, light = z.light;
    const ink = (l, a = 1) => mark.grey ? `hsl(0 0% 78% / ${a})`
      : `hsl(${hue} ${sat}% ${Math.max(6, Math.min(94, l))}% / ${a})`;
    const colors = { stiel: ink(light - 16), blatt: ink(light - 6), kopf: ink(light + 8),
      hell: ink(light + 18), flaeche: ink(light - 26, 0.7), flug: (a) => ink(light + 18, a) };
    if (turnToName && state === "need") {
      const baseX = mark.size * 0.5, baseY = mark.size - 1.5;
      ctx.save(); ctx.translate(baseX, baseY); ctx.rotate(-0.65); ctx.translate(-baseX, -baseY);
    }
    ROUND5[fassung].paint(ctx, cache, z, colors);
    if (turnToName && state === "need") ctx.restore();
    if (z.beacon) round5Builder.paintBeacon(ctx, cache, z);
  },
};
}
const Round5Flower = round5Renderer("r5a", "R5-A · Blüte", "bluete");
const Round5Branch = round5Renderer("r5b", "Kontrolle · R5-B", "zweig");
const Round5Seeds = round5Renderer("r5c", "R5-C · Samenstand", "samen");
const Branch2 = round5Renderer("b2", "B2 · Zweig zum Namen", "zweig", true);

export const RENDERERS = [Branch2, Arm2, Round5Flower, Round5Branch, Round5Seeds, Arm, Kamon, Lantern, Branch];
const byId = Object.fromEntries(RENDERERS.map((r) => [r.id, r]));
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)");
const moving = (s) => s === "work" || s === "need" || s === "bad";

export class MarkenStage {
  constructor(canvas, options = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.dprFixed = options.dpr;
    this.cells = []; this.raf = 0; this.fps = 0; this.frames = 0; this.on = true;
    this.wake = () => this.sync();
    REDUCE.addEventListener("change", this.wake);
    document.addEventListener("visibilitychange", this.wake);
  }
  setRows(rows, width, height) {
    const dpr = this.dprFixed ?? Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`; this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cells = rows.map((m) => ({ mark: m, renderer: byId[m.renderer] ?? Arm,
      cache: (byId[m.renderer] ?? Arm).layout(m), painted: false }));
    this.sync();
  }
  sync() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const c of this.cells) c.painted = false;
    this.paint(0, true);
    if (!this.on || document.hidden || REDUCE.matches || !this.cells.some((c) => moving(c.mark.state))) return;
    this.t0 = performance.now(); this.frames = 0;
    this.raf = requestAnimationFrame((now) => this.frame(now));
  }
  frame(now) {
    this.frames++;
    if (now - this.t0 >= 500) { this.fps = this.frames * 1000 / (now - this.t0); this.frames = 0; this.t0 = now; }
    this.paint(now / 1000, false);
    this.raf = requestAnimationFrame((next) => this.frame(next));
  }
  paint(t, force) {
    const ctx = this.ctx;
    for (const c of this.cells) {
      if (!force && c.painted && !moving(c.mark.state)) continue;
      c.painted = true;
      const m = c.mark;
      ctx.save(); ctx.beginPath(); ctx.rect(m.x, m.y, m.size, m.size); ctx.clip();
      ctx.fillStyle = "#000"; ctx.fillRect(m.x, m.y, m.size, m.size);
      if (m.state !== "free") {
        ctx.translate(m.x, m.y);
        c.renderer.draw(ctx, m, c.cache, t, REDUCE.matches);
      }
      ctx.restore();
    }
  }
  bench() {
    const start = performance.now();
    for (let i = 0; i < 90; i++) this.paint(i / 60, true);
    return { ms: +( (performance.now() - start) / 90).toFixed(3), cells: this.cells.length };
  }
  dispose() { cancelAnimationFrame(this.raf); REDUCE.removeEventListener("change", this.wake); document.removeEventListener("visibilitychange", this.wake); }
}

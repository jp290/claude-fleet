// The conversation view's backdrop: small white flakes drifting slowly over pure black
// (owner 2026-09-19: "auf dem kleine weiße flakes angenehm umherschwirren").
//
// One canvas per pane, behind the text and pointer-events:none (index.html .chatflakes). It only
// animates while its pane is in the chat view AND the tab is visible AND the viewer has not asked
// for reduced motion — in the last case it paints one still frame, so the texture stays and the
// movement goes. Density scales with the area, so a 2x2 layout does not quadruple the work.

interface Flake { x: number; y: number; r: number; a: number; vy: number; sway: number; phase: number }

const REDUCE = matchMedia("(prefers-reduced-motion: reduce)");
const all = new Set<Flakes>();
const wake = () => { for (const f of all) f.sync(); };
document.addEventListener("visibilitychange", wake);
REDUCE.addEventListener("change", wake);

export class Flakes {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private flakes: Flake[] = [];
  private w = 0;
  private h = 0;
  private on = false;
  private raf = 0;
  private last = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "chatflakes";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    all.add(this);
  }

  // the pane says whether its chat view is showing; visibility and motion preference are ours
  setActive(on: boolean): void {
    this.on = on;
    this.sync();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    all.delete(this);
  }

  sync(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!this.on || document.hidden) return;
    this.resize();
    if (REDUCE.matches) { this.draw(); return; }
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private resize(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h || (w === this.w && h === this.h)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    const want = Math.min(110, Math.round((w * h) / 9000));
    this.flakes = Array.from({ length: want }, () => this.spawn(Math.random() * h));
    if (this.on && REDUCE.matches) this.draw();
  }

  private spawn(y: number): Flake {
    const r = 0.35 + Math.random() ** 2 * 1.25;
    return {
      x: Math.random() * this.w, y, r,
      a: 0.18 + Math.random() * 0.55,
      // bigger = nearer = a touch faster: the cheapest depth cue there is
      vy: 3 + r * 7 + Math.random() * 4,
      sway: 4 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private frame(t: number): void {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    for (const f of this.flakes) {
      f.y += f.vy * dt;
      f.phase += dt * 0.35;
      if (f.y - f.r > this.h) Object.assign(f, this.spawn(-2));
    }
    this.draw();
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  private draw(): void {
    const c = this.ctx;
    if (!c) return;
    c.clearRect(0, 0, this.w, this.h);
    c.fillStyle = "#fff";
    for (const f of this.flakes) {
      c.globalAlpha = f.a * (0.75 + 0.25 * Math.sin(f.phase * 3));
      c.beginPath();
      c.arc(f.x + Math.sin(f.phase) * f.sway, f.y, f.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}

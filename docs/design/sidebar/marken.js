// Die Session-Marke: ein abgeleitetes Zeichen je Session. KEINE zweite Identitaet — der Farbton
// kommt aus dem vorhandenen Algorithmus (src/client.ts#projectHue, acht quantisierte Toene, "one hue
// per checkout, derived, never stored"). Dazu kommen nur Fakten, die der Server ohnehin liefert:
// Harness, Rolle, Slot, openedAt, Zustand.
//
// Regel: Was aussieht wie Bedeutung, IST Bedeutung.
//   Farbton   = Projekt        (projectHue, unveraendert uebernommen)
//   Muster    = Harness        (claude = Ringe · codex = Zeilen · pi = Gitter)
//   Variante  = Slot + openedAt (Seed: dieselbe Session behaelt ihr Zeichen ueber einen Neustart)
//   Rand      = Rolle          (MAIN = geschlossener Rahmen, Lane = offener)
//   Bewegung  = Zustand        (arbeitet = laeuft · ruht = steht · schlaeft = gedimmt · Fehler = bricht)
// Ohne Farbe bleibt die Marke lesbar: Musterfamilie und Bewegung tragen allein.

export const PROJECT_HUES = [8, 45, 88, 135, 175, 205, 260, 315];

export function projectHue(path) {
  let h = 0x811c9dc5; // FNV-1a, wie im Client
  for (let i = 0; i < path.length; i++) { h ^= path.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return PROJECT_HUES[(h >>> 0) % PROJECT_HUES.length];
}

// Harness-Familie: die drei, die der Client kennt (src/icons.ts#harnessMark: claude, codex, pi-*)
export function family(harness) {
  if (harness === "codex") return "lines";
  if (harness === "pi" || harness.startsWith("pi-")) return "grid";
  return "rings";
}

// Seed aus Slot und Oeffnungszeit: stabil ueber Neustarts, verschieden fuer zwei Sessions desselben
// Projekts. Kein Zufall zur Laufzeit — dieselbe Session zeichnet nach jedem Reload dasselbe.
export function seedOf(slot, openedAt) {
  let h = 0x811c9dc5;
  for (const ch of String(slot) + ":" + String(openedAt)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}

const STATE = {
  work:  { alpha: 1,    sat: 62, light: 62, moves: true },
  rest:  { alpha: 0.72, sat: 40, light: 52, moves: false },
  sleep: { alpha: 0.34, sat: 12, light: 44, moves: false },
  bad:   { alpha: 1,    sat: 70, light: 58, moves: true },
};

// Ein Zeichen, in einen 2D-Kontext gemalt. size = CSS-Pixel, phase = 0..1 (nur fuer Bewegung).
export function drawMark(ctx, o) {
  const { size, hue, fam, seed, state } = o, st = STATE[state] ?? STATE.rest, ph = st.moves ? (o.phase ?? 0) : 0;
  const c = size / 2, col = (l, a = 1) => `hsl(${hue} ${st.sat}% ${l}% / ${a * st.alpha})`;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  // Grundflaeche: derselbe Ton, sehr dunkel — die Marke sitzt auf Schwarz und traegt ihre eigene Flaeche
  ctx.fillStyle = `hsl(${hue} ${Math.round(st.sat * 0.5)}% 11% / ${st.alpha})`;
  roundRect(ctx, 0.5, 0.5, size - 1, size - 1, size * 0.28); ctx.fill();

  if (fam === "rings") {
    // claude: konzentrische Ringe, die im Arbeiten langsam auseinanderlaufen
    ctx.lineWidth = Math.max(1, size * 0.055);
    for (let i = 0; i < 4; i++) {
      const t = (i / 4 + seed + ph) % 1;
      ctx.globalAlpha = 1 - t * 0.75;
      ctx.strokeStyle = col(st.light + (i % 2 ? 10 : 0));
      ctx.beginPath(); ctx.arc(c, c, size * (0.08 + t * 0.34), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (fam === "lines") {
    // codex: waagrechte Zeilen, im Arbeiten wandert eine helle Zeile durch
    const rows = 5, gap = size / (rows + 1);
    for (let i = 0; i < rows; i++) {
      const y = gap * (i + 1), w = size * (0.3 + 0.52 * ((seed * (i + 3)) % 1));
      const hot = st.moves && Math.floor((ph * rows + i) % rows) === 0;
      ctx.fillStyle = col(hot ? st.light + 22 : st.light, hot ? 1 : 0.7);
      ctx.fillRect(size * 0.16, y - size * 0.03, w, Math.max(1, size * 0.062));
    }
  } else {
    // pi: Punktgitter, im Arbeiten laeuft eine Welle diagonal hindurch
    const n = 3, step = size / (n + 1);
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      const d = (x + y) / (2 * n), on = ((seed * 977 + x * 7 + y * 13) % 5) > 1;
      const puls = st.moves ? 0.55 + 0.45 * Math.sin((ph - d) * Math.PI * 2) : 0.85;
      ctx.fillStyle = col(st.light + (on ? 12 : 0), (on ? 1 : 0.45) * puls);
      ctx.beginPath(); ctx.arc(step * (x + 1), step * (y + 1), size * (on ? 0.085 : 0.055), 0, Math.PI * 2); ctx.fill();
    }
  }

  // Rahmen = Rolle: MAIN geschlossen, Lane offen (unten offen), damit die Rolle ohne Farbe lesbar ist
  ctx.lineWidth = 1; ctx.strokeStyle = col(st.light + 16, state === "sleep" ? 0.5 : 0.85);
  if (o.role === "lane") { ctx.beginPath(); ctx.moveTo(size * 0.72, 0.5); ctx.lineTo(size - 0.5, 0.5);
    ctx.lineTo(size - 0.5, size * 0.72); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0.5, size * 0.28);
    ctx.lineTo(0.5, 0.5); ctx.lineTo(size * 0.28, 0.5); ctx.stroke(); }
  else { roundRect(ctx, 0.5, 0.5, size - 1, size - 1, size * 0.28); ctx.stroke(); }

  // Fehler bricht die Ruhe: rote Schraffur ueber allem, unabhaengig vom Projektton
  if (state === "bad") {
    ctx.strokeStyle = `hsl(2 72% 62% / ${0.55 + 0.35 * Math.sin(ph * Math.PI * 2)})`;
    ctx.lineWidth = Math.max(1, size * 0.07);
    for (let i = -1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * size * 0.34, size); ctx.lineTo(i * size * 0.34 + size, 0); ctx.stroke(); }
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// EIN Taktgeber fuer alle Marken. Er laeuft nur, wenn mindestens eine Marke sich bewegt, der Tab
// sichtbar ist und niemand reduzierte Bewegung verlangt hat — sonst steht genau ein Standbild.
// Ohne diesen gemeinsamen Takt haette jede Marke ihre eigene Schleife; bei 16 Marken ist das der
// Unterschied zwischen einer und sechzehn rAF-Ketten.
export class MarkTicker {
  constructor(fps = 8) { this.marks = new Set(); this.fps = fps; this.raf = 0; this.last = 0; this.frames = 0; this.t0 = 0;
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const wake = () => this.sync();
    document.addEventListener("visibilitychange", wake); this.reduce.addEventListener("change", wake); }
  add(m) { this.marks.add(m); m.paint(0); this.sync(); }
  clear() { this.marks.clear(); this.sync(); }
  get moving() { return !this.reduce.matches && !document.hidden && [...this.marks].some((m) => m.moves); }
  sync() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const m of this.marks) m.paint(0);                 // Standbild, auch wenn nichts laeuft
    if (!this.moving) return;
    this.t0 = performance.now(); this.frames = 0;
    const step = (t) => {
      if (t - this.last >= 1000 / this.fps) { this.last = t; this.frames++;
        const ph = (t / 9000) % 1;                          // ein Durchlauf alle 9 s
        for (const m of this.marks) if (m.moves) m.paint(ph); }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  // gemessene Bilder je Sekunde der MARKEN (nicht des Browsers): Zeichenvorgaenge / Laufzeit
  rate() { const s = (performance.now() - this.t0) / 1000; return s > 0 ? this.frames / s : 0; }
  // Kosten: wie lange dauert EIN vollstaendiges Bild ueber alle bewegten Marken? Deterministisch
  // messbar, auch im Headless-Browser, der rAF anhaelt. Daraus faellt der Anteil eines Kerns heraus.
  bench(passes = 60) {
    const moving = [...this.marks].filter((m) => m.moves);
    if (!moving.length) return { ms: 0, moving: 0, total: this.marks.size, share: 0 };
    for (let i = 0; i < 10; i++) for (const m of moving) m.paint(i / 10);   // warmlaufen
    const t0 = performance.now();
    for (let i = 0; i < passes; i++) for (const m of moving) m.paint((i % 20) / 20);
    const ms = (performance.now() - t0) / passes;
    return { ms, moving: moving.length, total: this.marks.size, share: (ms * this.fps) / 10 };
  }
}

// Eine Marke haengt an ihrem Canvas. Groesse und Position aendern sich nie beim Aktualisieren —
// das Canvas hat feste Masse, also kann kein Layout springen.
export class Mark {
  constructor(canvas, o) {
    this.o = o; this.canvas = canvas;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = o.size * dpr; canvas.height = o.size * dpr;
    canvas.style.width = canvas.style.height = o.size + "px";
    this.ctx = canvas.getContext("2d"); this.ctx.scale(dpr, dpr);
  }
  get moves() { return this.o.state === "work" || this.o.state === "bad"; }
  paint(phase) { drawMark(this.ctx, { ...this.o, phase }); }
}

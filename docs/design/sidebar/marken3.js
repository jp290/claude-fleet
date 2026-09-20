// Runde 3. Der Kurswechsel des Owners ("ganz neuer kreativer Ansatz") und der Satz aus dem
// Recherchebericht, der ihn traegt: "Das Werk ist das laufende System, nicht der Screenshot."
//
// Die Marke ist hier also kein Zeichen, das wir zeichnen, sondern ein winziges laufendes System je
// Session. Daraus folgt ein Widerspruch, den jedes der drei Systeme unten aufloesen MUSS, und er
// ist die eigentliche Entwurfsarbeit dieser Runde:
//
//   Ein laufendes System veraendert sich. Eine Identitaet darf sich NICHT veraendern.
//
// Aufloesung: was laeuft, ist der ZUSTAND; was steht, ist die REGEL. Das Feld, die Regelnummer,
// die Attraktor-Parameter kommen aus dem Seed und aendern sich nie — sie sind sichtbar, auch wenn
// das System eingefroren ist. Die Bewegung darueber ist der Zustand der Session. Ein System, dessen
// Bild erst durch das Laufen ENTSTEHT (Wachstum, Diffusion), faellt damit aus: es haette keine
// Identitaet, solange es ruht. Das ist der Grund, warum unten Stroemung, Automat und Attraktor
// stehen und nicht DLA oder Reaktions-Diffusion.
//
// Hartes Constraint, aus dem Bericht ("eine Farbe, eine Form"): jede Marke hat GENAU EINEN Farbton
// — den des Projekts — und variiert nur die Helligkeit. Kein zweiter Ton, kein Verlauf, kein
// Schlagschatten. Und: noise() statt random(), ueberall, aus demselben Seed.
//
// Bauform: src/flakes.ts. EINE Canvas fuer die ganze Leiste, EIN requestAnimationFrame, Stillstand
// bei prefers-reduced-motion und im versteckten Tab, ein Standbild statt nichts. Keine Library.

import { projectHue, family } from "./marken.js";
export { projectHue, family } from "./marken.js";

// --- Seed und Zufall ohne Struktur vermeiden -------------------------------------------------
// FNV-1a ueber die abgeleitete Identitaet. Derselbe Slot mit derselben Oeffnungszeit im selben
// Repo ergibt immer dieselbe Zahl — ueber Neustart und Re-Slotting hinweg. Nichts wird gespeichert.
export function seedOf(ident) {
  const s = `${ident.repo}|${ident.harness}|${ident.role}|${ident.slot}|${ident.openedAt}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// mulberry32: ein kleiner, schneller, deterministischer PRNG. Er ersetzt Math.random vollstaendig;
// jede Marke bekommt ihren eigenen Strom aus ihrem eigenen Seed.
export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Eigener Sinus, und zwar aus einem gemessenen Grund. `Math.sin` und `Math.cos` sind in ECMAScript
// AUSDRUECKLICH implementierungsabhaengig — die Norm verlangt keine bestimmte Genauigkeit. Dieselben
// Parameter ergaben in Bun (JavaScriptCore) und in Chrome (V8) verschiedene Bahnen: die Belegung des
// Attraktors von Slot 1 war dort 71, hier 48 Felder. Bei einem chaotischen System genuegt ein
// Unterschied in der letzten Stelle, und nach tausend Schritten ist es eine andere Figur.
//
// Fuer eine IDENTITAET ist das ein Defekt, kein Detail: dieselbe Session saehe auf dem Telefon anders
// aus als auf dem Rechner. Also rechnen wir den Sinus selbst — Reduktion auf [-PI, PI] und eine
// Taylor-Reihe bis x^11. Die ist nicht genauer als Math.sin (Fehler ~2e-8), aber sie ist ueberall
// dieselbe, und genau das ist hier verlangt. Nur +, *, / und Math.floor, alles IEEE-754-bestimmt.
const PI = 3.141592653589793, TWO_PI = 6.283185307179586;
export function dsin(x) {
  x -= TWO_PI * Math.floor((x + PI) / TWO_PI);
  const q = x * x;
  return x * (1 + q * (-1 / 6 + q * (1 / 120 + q * (-1 / 5040 + q * (1 / 362880 + q * (-1 / 39916800))))));
}
export function dcos(x) { return dsin(x + 1.5707963267948966); }

// Wert-Rauschen, zweidimensional, aus demselben Seed. Der Bericht nennt den Grund beim Namen:
// "Reines random() erzeugt Speckle, kein Rhythmus." Das hier hat Rhythmus, weil benachbarte
// Gitterpunkte weich ineinander laufen statt unabhaengig zu wuerfeln.
export function noiseOf(seed) {
  const hash = (x, y) => {
    let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t) => t * t * (3 - 2 * t);           // smoothstep, kein linearer Knick
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = fade(x - xi), yf = fade(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
  };
}

// --- Der Zustand moduliert das laufende System, er faerbt es nicht ----------------------------
// `drive` ist die Geschwindigkeit der Systemzeit, `erode` das Zerfallen, `noiseIn` die Stoerung.
// Jedes System liest dieselben drei Zahlen — deshalb sagen alle drei dasselbe ueber den Zustand,
// obwohl sie voellig verschiedene Bilder erzeugen.
export const MOD = {
  work:  { drive: 1,    erode: 0,    noiseIn: 0,   light: 62, alive: true  },
  need:  { drive: 0.55, erode: 0,    noiseIn: 0,   light: 70, alive: true, beacon: true },
  rest:  { drive: 0,    erode: 0,    noiseIn: 0,   light: 54, alive: false },
  done:  { drive: 0,    erode: 0,    noiseIn: 0,   light: 40, alive: false },
  // schlafend ZERFAELLT: es laeuft fast nicht mehr und verliert staendig Substanz. Es geht aber
  // nie ganz aus — ein Platz ohne Marke reisst die Achse der Spalte auf (Befund 6 aus Runde 2).
  //
  // Die Zahlen hier sind gemessen, nicht geschaetzt. Mit drive 0,13 bewegte sich eine SCHLAFENDE
  // Marke im Automaten fast so viel wie eine arbeitende (2,13 % gegen 2,31 % veraenderte Pixel je
  // 1,5 s) — der Zustand war damit nicht ablesbar, und das ist der eine Zweck der ganzen Uebung.
  // Zerfall darf nicht zappeln: selten etwas tun, dafuer staendig ein wenig verlieren.
  sleep: { drive: 0.03, erode: 0.010, noiseIn: 0, light: 48, alive: true, gray: true },
  bad:   { drive: 1.4,  erode: 0,    noiseIn: 0.5, light: 64, alive: true, red: true },
  free:  { drive: 0,    erode: 0,    noiseIn: 0,   light: 22, alive: false, empty: true },
};

// --- System A: Stroemung ----------------------------------------------------------------------
// Regel: ein Vektorfeld aus Wert-Rauschen, in dem eine Handvoll Agenten schwimmt und Spuren zieht.
// Identitaet: das FELD. Seine Wirbel liegen fest, also zeichnen zwei Sessions zwei verschiedene
// Linienbilder — auch eingefroren, auch ohne Farbe.
const Stroemung = {
  id: "stroemung",
  init(c) {
    const r = rngOf(c.seed), n = noiseOf(c.seed);
    c.noise = n;
    c.freq = 0.10 + r() * 0.10;            // Wirbelgroesse: 2 bis 4 Wirbel je Marke
    c.ox = r() * 64; c.oy = r() * 64;      // Ausschnitt des Feldes = die Identitaet
    c.turn = 0.6 + r() * 2.2;              // wie stark das Feld dreht
    c.agents = Array.from({ length: 7 }, () => ({
      x: r() * c.w, y: r() * c.h, px: 0, py: 0, life: r(),
    }));
    for (const a of c.agents) { a.px = a.x; a.py = a.y; }
    c.warm = 60;                           // Einbrennen, damit die Marke ab Bild 0 dasteht
  },
  step(c, dt, m) {
    const sp = 13 * m.drive * (m.noiseIn ? 2.1 : 1);
    for (const a of c.agents) {
      a.px = a.x; a.py = a.y;
      const ang = (c.noise(a.x * c.freq + c.ox, a.y * c.freq + c.oy) * c.turn) * Math.PI * 2
                + (m.noiseIn ? (c.noise(a.y * 0.9 + c.t * 3, a.x * 0.9) - 0.5) * 6 * m.noiseIn : 0);
      a.x += dcos(ang) * sp * dt;
      a.y += dsin(ang) * sp * dt;
      a.life -= dt * 0.45 * (m.drive || 1);
      // Ein Agent, der herauslaeuft oder ausgeht, faengt an einer aus dem Seed abgeleiteten
      // Stelle neu an — nicht an einer zufaelligen, sonst driftet die Marke ueber Stunden weg.
      if (a.life <= 0 || a.x < -1 || a.y < -1 || a.x > c.w + 1 || a.y > c.h + 1) {
        const k = (c.t * 7 + a.life * 13) % 1;
        a.x = c.noise(k * 31 + c.ox, 7.3) * c.w;
        a.y = c.noise(3.1, k * 29 + c.oy) * c.h;
        a.px = a.x; a.py = a.y; a.life = 0.6 + c.noise(k * 11, k * 5) * 0.8;
      }
    }
  },
  paint(ctx, c, m, col) {
    // Einbrennen: 150 Schritte in einem Zug, EINMAL. Ohne das waere eine ruhende Marke leer, denn
    // sie zeichnet ja nichts mehr — und genau das ist der Punkt des Entwurfs: das Feld muss auch
    // dann dastehen, wenn nichts mehr laeuft. Die Marke ist ab Bild 0 fertig.
    if (c.warm) {
      ctx.fillStyle = "#000"; ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = col(m.light + 8, 0.5); ctx.lineWidth = 1;
      const voll = { drive: 1, erode: 0, noiseIn: 0 };
      for (let i = 0; i < 150; i++) {
        this.step(c, 1 / 60, voll);
        ctx.beginPath();
        for (const a of c.agents) { ctx.moveTo(c.x + a.px, c.y + a.py); ctx.lineTo(c.x + a.x, c.y + a.y); }
        ctx.stroke();
      }
      c.warm = 0;
      return;
    }
    // Spurenbild: die Flaeche wird nur gedunkelt, wenn das System laeuft — im Ruhen faellt kein
    // Bild weg, die Marke steht einfach still. Genau das meint "ruhend friert ein".
    const fade = 0.055 * m.drive + m.erode;
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(c.x, c.y, c.w, c.h); }
    if (!m.drive) return;
    ctx.strokeStyle = col(m.light + 12, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const a of c.agents) { ctx.moveTo(c.x + a.px, c.y + a.py); ctx.lineTo(c.x + a.x, c.y + a.y); }
    ctx.stroke();
  },
};

// --- System B: Automat ------------------------------------------------------------------------
// Regel: ein elementarer zellulaerer Automat. Aus einer Anfangszeile wird Zeile fuer Zeile eine
// neue berechnet; das Bild ist das Raum-Zeit-Diagramm und scrollt nach oben.
// Identitaet: Regelnummer UND Anfangszeile. Das Harness waehlt die Regelfamilie (drei Texturen,
// die man nicht verwechselt), der Session-Seed die Regel darin und die Anfangszeile.
// Die Regelwahl ist ENTWURF, nicht Geschmack. Der erste Versuch nahm die beruehmten chaotischen
// Regeln (30, 45, 105) und eine dichte Anfangszeile — das Ergebnis war genau die Rauschwand, die
// unter "kippt bei" steht: fuenf claude-Marken nebeneinander sahen aus wie fuenfmal Fernsehschnee.
// Ein Automat der Klasse 3 mit voller Entropie am Anfang hat nach drei Zeilen keine Gestalt mehr.
// Also: Regeln, die aus WENIGEN Zellen eine Struktur aufbauen, und eine SPARSAME Anfangszeile.
const REGELN = {
  rings: [90, 150, 22, 105],     // claude: symmetrische Fraktale (Sierpinski, Verschachtelung)
  lines: [60, 102, 154, 30],     // codex: einseitige Dreiecke, klare Diagonalen
  grid:  [110, 54, 73, 126],     // pi: Baender und wandernde Teilchen
};
const Automat = {
  id: "automat",
  init(c) {
    const r = rngOf(c.seed);
    const fam = REGELN[c.fam] ?? REGELN.rings;
    c.rule = fam[Math.floor(r() * fam.length)];
    c.cols = Math.max(12, Math.round(c.w));
    c.rows = Math.max(12, Math.round(c.h));
    // Anfangszeile: ZWEI bis VIER Zellen an Stellen aus dem Seed. Eine einzelne Zelle gaebe jeder
    // Marke derselben Regel dasselbe Bild; eine dichte Zeile gaebe allen dasselbe Rauschen. Dazwischen
    // liegt der Bereich, in dem die Regel eine Struktur baut und die Startstellen sie unterscheidbar
    // machen — bei Regel 90 ist der Unterschied zwischen zwei und drei Keimen sofort zu sehen.
    const row = new Uint8Array(c.cols);
    const keime = 2 + Math.floor(r() * 3);
    for (let k = 0; k < keime; k++) row[Math.floor(r() * c.cols)] = 1;
    if (!row.some(Boolean)) row[c.cols >> 1] = 1;
    c.grid = [row];
    c.acc = 0;
    for (let i = 0; i < c.rows - 1; i++) this.tick(c, { noiseIn: 0, erode: 0 }, r);   // einbrennen
    c.rnd = r;
  },
  tick(c, m, r) {
    const prev = c.grid[c.grid.length - 1], next = new Uint8Array(c.cols);
    for (let i = 0; i < c.cols; i++) {
      const l = prev[(i - 1 + c.cols) % c.cols], s = prev[i], rr = prev[(i + 1) % c.cols];
      next[i] = (c.rule >> ((l << 2) | (s << 1) | rr)) & 1;
      // Stoerung: eine einzelne gekippte Zelle. In einem Automaten pflanzt sie sich als sichtbare
      // Stoerlinie fort — der Fehler bleibt im Bild stehen, statt es nur rot zu faerben.
      if (m.noiseIn && r() < m.noiseIn * 0.08) next[i] ^= 1;
      // Zerfall: schlafend verliert das Bild Substanz, aber die Regel erzeugt sie teilweise neu.
      if (m.erode && r() < m.erode * 2.4) next[i] = 0;
    }
    c.grid.push(next);
    if (c.grid.length > c.rows) c.grid.shift();
  },
  step(c, dt, m) {
    if (!m.drive) return;
    c.acc += dt * m.drive * 7;                    // rund sieben neue Zeilen je Sekunde
    let n = 0;
    while (c.acc >= 1 && n < 4) { c.acc -= 1; this.tick(c, m, c.rnd); n++; }
    c.dirty = n > 0;
  },
  paint(ctx, c, m, col) {
    if (!c.dirty && c.painted) return;            // nur bei einem Takt neu zeichnen, nicht je Bild
    c.dirty = false; c.painted = true;
    ctx.fillStyle = "#000"; ctx.fillRect(c.x, c.y, c.w, c.h);
    const cw = c.w / c.cols, ch = c.h / c.rows;
    for (let y = 0; y < c.grid.length; y++) {
      // die aelteste Zeile oben ist die blasseste: die Zeit selbst ist ein Helligkeitsverlauf
      const age = y / c.rows;
      ctx.fillStyle = col(m.light - 16 + age * 26, 0.35 + age * 0.6);
      const row = c.grid[y], ry = c.y + y * ch;
      for (let x = 0; x < c.cols; x++) if (row[x]) ctx.fillRect(c.x + x * cw, ry, cw + 0.4, ch + 0.4);
    }
  },
};

// --- System C: Attraktor ----------------------------------------------------------------------
// Regel: eine iterierte Abbildung (Clifford). Vier Parameter aus dem Seed, und der Punkt wandert
// fuer immer auf derselben Figur. Gezeichnet wird akkumulierend — das Bild ist die Spur der Zeit.
// Identitaet: die vier Parameter. Der Formenraum ist riesig, zwei Seeds sehen nie gleich aus.
const Attraktor = {
  id: "attraktor",
  init(c) {
    const r = rngOf(c.seed);
    // Verwerfen statt hoffen: viele Parametersaetze fallen auf einen Punkt, eine Linie oder einen
    // kurzen Zyklus zusammen und ergaeben eine fast leere Marke. Wir probieren deterministisch, bis
    // die Figur die Zelle wirklich FUELLT.
    //
    // Der erste Test hier mass die Spannweite — und liess genau die schlimmsten Faelle durch: ein
    // periodischer Orbit aus sechs Punkten hat eine grosse Spannweite und trotzdem sechs Punkte.
    // Im gerenderten Bild waren zwei von 19 Marken leer. Gemessen wird deshalb die BELEGUNG: wie
    // viele Felder eines 12x12-Rasters besucht die Bahn ueberhaupt.
    //
    // Und sie wird SPAET gemessen. Der zweite Versuch nahm die Iterationen 120 bis 600 — das ist bei
    // einigen Parametersaetzen noch der Einschwingvorgang. Slot 1 sah dort mit 48 belegten Feldern
    // gesund aus und lief danach auf einen Zyklus aus fuenf Punkten; im Bild standen fuenf Punkte.
    // Wer den Attraktor messen will, muss warten, bis die Bahn auf ihm ist.
    let best = null, bestFill = -1;
    for (let tryN = 0; tryN < 12; tryN++) {
      const p = { a: -2 + r() * 4, b: -2 + r() * 4, c: -2 + r() * 4, d: -2 + r() * 4 };
      let x = 0.1, y = 0.1, minx = 9, maxx = -9, miny = 9, maxy = -9;
      const pts = [];
      for (let i = 0; i < 1800; i++) {
        const nx = dsin(p.a * y) + p.c * dcos(p.a * x);
        y = dsin(p.b * x) + p.d * dcos(p.b * y); x = nx;
        if (i > 900) { pts.push(x, y);
          minx = Math.min(minx, x); maxx = Math.max(maxx, x);
          miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
      }
      const sx = maxx - minx, sy = maxy - miny;
      let fill = 0;
      if (sx > 0.4 && sy > 0.4) {
        const seen = new Set();
        for (let i = 0; i < pts.length; i += 2) {
          const gx = Math.min(11, Math.floor((pts[i] - minx) / sx * 12));
          const gy = Math.min(11, Math.floor((pts[i + 1] - miny) / sy * 12));
          seen.add(gy * 12 + gx);
        }
        fill = seen.size;                       // 0..144 belegte Felder
      }
      if (fill > bestFill) {
        bestFill = fill;
        best = { p, x, y, sx: c.w / (sx + 0.3), sy: c.h / (sy + 0.3),
                 cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 };
      }
      if (fill >= 34) break;                    // gut genug: die Bahn besucht ein Viertel des Rasters
    }
    c.p = best.p; c.px = best.x; c.py = best.y;
    c.sx = best.sx; c.sy = best.sy; c.cx = best.cx; c.cy = best.cy;
    c.fill = bestFill;
    c.burn = 900;    // die Figur muss ab dem ersten Bild dastehen, nicht erst nach zwei Sekunden
  },
  plot(ctx, c, m, col, n, luecken = 0) {
    ctx.fillStyle = col(m.light + 14, 0.5);
    for (let i = 0; i < n; i++) {
      const nx = dsin(c.p.a * c.py) + c.p.c * dcos(c.p.a * c.px);
      c.py = dsin(c.p.b * c.px) + c.p.d * dcos(c.p.b * c.py); c.px = nx;
      const jx = m.noiseIn ? (dsin(c.t * 9 + i) * m.noiseIn * 0.5) : 0;   // Stoerung: die Figur reisst
      const X = c.x + c.w / 2 + (c.px - c.cx + jx) * c.sx;
      const Y = c.y + c.h / 2 + (c.py - c.cy) * c.sy;
      // die Luecken kommen aus der Bahn selbst, nicht aus einem Wuerfel: dieselbe Session
      // broeckelt bei jedem Takt an denselben Stellen, solange sie schlaeft
      if (luecken && ((c.px * 7919 + c.py * 104729) % 1 + 1) % 1 < luecken) continue;
      if (X >= c.x && X < c.x + c.w && Y >= c.y && Y < c.y + c.h) ctx.fillRect(X, Y, 0.9, 0.9);
    }
  },
  step() { /* die Figur entsteht beim Zeichnen — der Schritt IST der Punkt */ },
  paint(ctx, c, m, col) {
    if (c.burn) {                                  // Einbrennen, einmal
      ctx.fillStyle = "#000"; ctx.fillRect(c.x, c.y, c.w, c.h);
      this.plot(ctx, c, m, col, c.burn); c.burn = 0; return;
    }
    // Schlafend: der Zerfall sitzt in der STRUKTUR, nicht in der Helligkeit. Zwei Entwuerfe davor
    // sind an derselben Messung gescheitert: staendig ein wenig loeschen und nachzeichnen bewegte
    // die schlafende Marke fast so stark wie die arbeitende (0,67 % gegen 0,73 % veraenderte Pixel
    // je 1,5 s), und ein voller Neuaufbau alle zwei Sekunden war ein Blitz ueber die ganze Zelle
    // (1,23 %). Jede Verblassung ueber die ganze Flaeche zaehlt als Bewegung, egal wie leise sie ist.
    // Also: EINMAL die Figur mit Luecken zeichnen und dann still sein. Was fehlt, ist der Zerfall.
    if (m.erode) {
      if (c.zerfallen) return;
      c.zerfallen = true;
      ctx.fillStyle = "#000"; ctx.fillRect(c.x, c.y, c.w, c.h);
      this.plot(ctx, c, m, col, 900, 0.45);
      return;
    }
    c.zerfallen = false;
    const fade = 0.02 * m.drive;
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(c.x, c.y, c.w, c.h); }
    if (m.drive) this.plot(ctx, c, m, col, Math.round(55 * m.drive));
  },
};

export const SYSTEME = { stroemung: Stroemung, automat: Automat, attraktor: Attraktor };

// --- Die Buehne: EINE Canvas fuer die ganze Leiste --------------------------------------------
// Bauform woertlich aus `src/flakes.ts`: eine Canvas, ein requestAnimationFrame, ein `sync()`, das
// auf sichtbaren Tab UND prefers-reduced-motion prueft und im Zweifel EIN Standbild malt statt
// nichts. Der Unterschied zu Runde 1 und 2: dort hatte jede Marke ihre eigene Canvas und ihren
// eigenen Zeichenaufruf — hier gibt es 16 Zellen auf einer Flaeche und genau eine Schleife.
//
// Weil die Systeme AKKUMULIEREN (Spuren, Raum-Zeit-Diagramm, Punktwolke), wird die Canvas NIE
// vollstaendig geleert: jede Zelle dunkelt oder loescht nur ihr eigenes Rechteck. Das ist keine
// Sparmassnahme, es ist die Voraussetzung dafuer, dass Ruhe ein stehendes Bild ist und nicht Leere.
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)");

export class MarkStage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cells = [];
    this.raf = 0; this.last = 0; this.on = true;
    this.frames = 0; this.t0 = 0; this.fps = 0;
    this._wake = () => this.sync();
    document.addEventListener("visibilitychange", this._wake);
    REDUCE.addEventListener("change", this._wake);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this._wake);
    REDUCE.removeEventListener("change", this._wake);
  }

  // rows: [{ x, y, size, repo, harness, role, slot, openedAt, state, system }]
  setRows(rows, cssW, cssH) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, cssW, cssH);
    this.cells = rows.map((r) => {
      const sys = SYSTEME[r.system] ?? Stroemung;
      const c = {
        x: r.x, y: r.y, w: r.size, h: r.size, t: 0,
        seed: seedOf(r), fam: family(r.harness), hue: projectHue(r.repo),
        state: r.state, sys, ident: r,
      };
      if (r.state !== "free") sys.init(c);
      return c;
    });
    this.sync();
  }

  setState(i, state) {
    const c = this.cells[i];
    if (!c || c.state === state) return;
    c.state = state; c.painted = false; c.dirty = true;
    this.sync();
  }

  get anyAlive() { return this.cells.some((c) => (MOD[c.state] ?? MOD.rest).alive); }

  sync() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.paintAll(0);                                  // Standbild, immer — auch wenn nichts laeuft
    if (!this.on || document.hidden || REDUCE.matches || !this.anyAlive) return;
    this.last = performance.now(); this.t0 = this.last; this.frames = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t; this.frames++;
    if (t - this.t0 > 500) { this.fps = (this.frames * 1000) / (t - this.t0); this.t0 = t; this.frames = 0; }
    this.paintAll(dt);
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  paintAll(dt) {
    const ctx = this.ctx;
    for (const c of this.cells) {
      const m = MOD[c.state] ?? MOD.rest;
      if (m.empty) { this.paintFree(ctx, c); continue; }
      // Ein Farbton je Marke, nur Helligkeit variiert — das harte Constraint aus dem Bericht.
      // Schlafend verliert die Saettigung, rot ist der einzige Ton, der das Projekt ueberschreibt.
      const hue = m.red ? 2 : c.hue, sat = m.gray ? 0 : m.red ? 70 : 58;
      const col = (l, a = 1) => `hsl(${hue} ${sat}% ${Math.max(6, Math.min(94, l))}% / ${a})`;
      c.t += dt;
      c.sys.step(c, dt, m);
      // Der Preis der EINEN Canvas: eine Zelle kann ihre Nachbarn uebermalen. Die Stroemung tut es
      // sofort — ihre Agenten laufen ueber den Rand, und die Spur bleibt dort fuer immer stehen,
      // weil nur das eigene Rechteck gedunkelt wird. Also bekommt jede Zelle ihren Schnitt.
      ctx.save();
      ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
      c.sys.paint(ctx, c, m, col);
      ctx.restore();
      if (m.beacon) this.paintBeacon(ctx, c, col, m);
      if (c.warm) c.warm = 0;
    }
  }

  // Ein freier Platz haelt die Achse der Spalte: ein Rahmen, kein System, kein Takt.
  paintFree(ctx, c) {
    if (c.painted) return;
    c.painted = true;
    ctx.fillStyle = "#000"; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = "hsl(0 0% 24% / .85)"; ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 3.5, c.y + 3.5, c.w - 7, c.h - 7);
  }

  // `need` wartet auf den Owner. Es ist der einzige Zustand, der ueber den Rand der Zelle
  // hinausgeht — ein atmender Rahmen. Das System darunter laeuft weiter, nur langsamer.
  paintBeacon(ctx, c, col, m) {
    const a = 0.25 + 0.4 * (0.5 + 0.5 * dsin(c.t * 2.2));
    ctx.strokeStyle = col(m.light + 16, a); ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x + 0.75, c.y + 0.75, c.w - 1.5, c.h - 1.5);
  }

  // Deterministische Kostenmessung, unabhaengig von rAF: wie lange dauert EIN vollstaendiges Bild
  // ueber alle Zellen? Laeuft auch im Headless-Browser, der rAF anhaelt.
  bench(passes = 90) {
    for (let i = 0; i < 12; i++) this.paintAll(1 / 60);
    const t0 = performance.now();
    for (let i = 0; i < passes; i++) this.paintAll(1 / 60);
    const ms = (performance.now() - t0) / passes;
    const alive = this.cells.filter((c) => (MOD[c.state] ?? MOD.rest).alive).length;
    return { ms, alive, total: this.cells.length, share: ms * 60 / 10 };
  }
}

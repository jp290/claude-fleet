// Runde 5. Der Owner, woertlich (2026-09-25): "wir könnten sicherlich mit javascript irgendwelche
// blumen, pflanzen oder ähnliche Unterscheidungssymbole, erstellen lassen" — und zu Runde 3: "alle
// davon zugegebener maßen zu abstrakt". Die Antwort ist eine GESTALT, die man benennt ("die violette
// Tulpe", "der Farn"), nicht ein Muster, das man beschreibt.
//
// Eine Grammatik fuer alle drei Fassungen, damit jedes Mittel genau einen Fakt traegt:
//
//   Art          = Repo      der Fach-Index von projectHue — Art und Farbton sind DERSELBE Fakt,
//                            also bleibt das Projekt ohne Farbe lesbar, und zwei Repos teilen eine
//                            Art genau dann, wenn sie heute schon einen Farbton teilen (§F2)
//   Wuchs        = Rolle     wie viele Exemplare, wie gross: einzeln · Gruppe · Paar · geduckt · klein
//   Kleinmerkmal = Harness   Blattform (Bluete, Samenstand) bzw. Knospe an der Spitze (Zweig)
//   Exemplar     = Session   Neigung, Kruemmung, Blattstellung aus dem Seed von marken3.js
//   Bewegung     = Zustand   arbeitet: Wind · wartet: langsamer Wind + atmender Rahmen · ruht: still
//                            schlaeft: haengt, geschlossen · fertig: verblueht, aufrecht · Fehler: geknickt
//
// Aus Runde 3 gilt unveraendert: WAS LAEUFT, IST DER ZUSTAND; WAS STEHT, IST DIE REGEL. Die Pflanze ist
// aus dem Seed FERTIG GEWACHSEN, ab Bild 0, und aendert ihre Gestalt nicht. Zerfall sitzt in der
// STRUKTUR (Bluete zu, Zweige kahl, Samen weg), nie in einer Helligkeit, die ueber die Zelle blendet.
// Kein Math.random, kein Math.sin/cos in der Geometrie — dsin/dcos aus marken3.js, weil Math.sin
// implementierungsabhaengig ist. Bauform src/flakes.ts: eine Canvas je Leiste, ein rAF, Clip je Zelle.

import { seedOf, rngOf, dsin, dcos } from "./marken3.js";
import { projectHue, PROJECT_HUES } from "./marken.js";
export { seedOf, projectHue };

const PI = 3.141592653589793;
const GOLD = 2.399963229728653;                  // Goldener Winkel, fuer die Sonnenblume

export const ARTEN = {
  bluete: ["Tulpe", "Margerite", "Glocke", "Stern", "Mohn", "Winde", "Distel", "Rose"],
  zweig:  ["Farn", "Tanne", "Gras", "Weide", "Baum", "Kaktus", "Bambus", "Busch"],
  samen:  ["Pusteblume", "Dolde", "Ähre", "Rispe", "Sonnenblume", "Kolben", "Traube", "Quirl"],
};
const ARTIKEL = {
  Tulpe: "die", Margerite: "die", Glocke: "die", Stern: "der", Mohn: "der", Winde: "die", Distel: "die", Rose: "die",
  Farn: "der", Tanne: "die", Gras: "das", Weide: "die", Baum: "der", Kaktus: "der", Bambus: "der", Busch: "der",
  Pusteblume: "die", Dolde: "die", "Ähre": "die", Rispe: "die", Sonnenblume: "die", Kolben: "der", Traube: "die", Quirl: "der",
};
// in der Reihenfolge von PROJECT_HUES: 8 · 45 · 88 · 135 · 175 · 205 · 260 · 315
const FARBWORT = ["rote", "goldene", "lindgrüne", "grüne", "türkise", "blaue", "violette", "rosa"];

export const ROLLEN = {
  main:    { name: "Program-MAIN",   wuchs: "einzeln" },
  orch:    { name: "Orchestratorin", wuchs: "Gruppe aus drei" },
  astra:   { name: "Astra",          wuchs: "Paar" },
  steward: { name: "Steward",        wuchs: "geduckt, mit Rosette" },
  lane:    { name: "Lane",           wuchs: "klein" },
};
export const HARNESS = {
  claude: { bluete: "runde Blätter", zweig: "Knospe an jeder Spitze" },
  codex:  { bluete: "schmale Blätter", zweig: "kahle Spitzen" },
  pi:     { bluete: "gefiederte Blätter", zweig: "gegabelte Spitzen" },
};
export const harnessOf = (h) => (h === "codex" ? "codex" : h === "pi" || h?.startsWith("pi-") ? "pi" : "claude");
export const artOf = (repo) => Math.max(0, PROJECT_HUES.indexOf(projectHue(repo ?? "")));

export function nameOf(fassung, repo, rolle) {
  const art = ARTEN[fassung][artOf(repo)];
  return `${ARTIKEL[art]} ${FARBWORT[artOf(repo)]} ${art} · ${ROLLEN[rolle]?.wuchs ?? ""}`;
}

// --- Zustand: was sich bewegt und wie die Gestalt sich schliesst -------------------------------
// amp = Windstaerke (Radiant ueber die ganze Achse), om = Takt. `lauf` entscheidet, ob die Zelle je
// Bild neu gemalt wird — nur dann bewegt sie sich; alles andere steht nach einem Bild.
export const ZUSTAND = {
  work:  { lauf: true,  amp: 0.30, om: 1.7,  light: 64, offen: 1 },
  need:  { lauf: true,  amp: 0.12, om: 0.8,  light: 70, offen: 1, beacon: true },
  rest:  { lauf: false, light: 60, offen: 1 },
  done:  { lauf: false, light: 44, offen: 1, verblueht: true },
  sleep: { lauf: false, light: 48, offen: 0, gray: true, haengt: true },
  bad:   { lauf: true,  amp: 0.07, om: 23,   light: 62, offen: 0.55, red: true, knick: true },
  free:  { lauf: false, leer: true },
};

// --- Wuchs aus der Rolle, Exemplar aus dem Seed ------------------------------------------------
// Das Exemplar wird IMMER fuer drei Pflanzen gewuerfelt, egal welche Rolle: stellt der Schalter die
// Rolle um, behaelt die erste Pflanze ihre Neigung — man sieht, was die ROLLE aendert, nicht einen
// neuen Wurf.
const LAYOUT = {
  main:    [{ bx: 0.5, h: 0.84, k: 1, blatt: 2 }],
  orch:    [{ bx: 0.5, h: 0.88, k: 0.86, blatt: 1 }, { bx: 0.2, h: 0.52, k: 0.66, blatt: 0 }, { bx: 0.8, h: 0.58, k: 0.66, blatt: 0 }],
  astra:   [{ bx: 0.32, h: 0.76, k: 0.8, blatt: 1 }, { bx: 0.68, h: 0.76, k: 0.8, blatt: 1 }],
  steward: [{ bx: 0.5, h: 0.52, k: 1.08, blatt: 4, rosette: true }],
  lane:    [{ bx: 0.5, h: 0.58, k: 0.74, blatt: 1 }],
};
function exemplare(seed, rolle) {
  const r = rngOf(seed);
  const wurf = [0, 1, 2].map(() => ({
    lean: (r() - 0.5) * 0.46, bxj: (r() - 0.5) * 0.1, hj: 0.9 + r() * 0.1,
    curl: (r() - 0.5) * 0.5, seite: r() < 0.5 ? -1 : 1, ph: r() * 6.283, rot: r() * 6.283, n: r(),
  }));
  return (LAYOUT[rolle] ?? LAYOUT.main).map((l, i) => ({ ...l, ...wurf[i], bx: l.bx + wurf[i].bxj, h: l.h * wurf[i].hj }));
}

// Lokaler Rahmen an einer Spitze: p entlang des Stiels, q quer dazu.
const rahmen = (x, y, a) => { const ux = dcos(a), uy = dsin(a); return (p, q) => [x + ux * p - uy * q, y + uy * p + ux * q]; };
const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

// Der Stiel: sieben Glieder, der Wind als Welle von der Wurzel zur Spitze (je hoeher, desto spaeter),
// Haengen, Knick und der Haken (Glocke, Traube) als Kruemmung einzelner Glieder.
function stiel(c, e, z, L, haken = 0) {
  const n = 7, dir = e.lean >= 0 ? 1 : -1;
  let a = -PI / 2 + e.lean, x = c.x + c.s * e.bx, y = c.y + c.s - 1.5;
  const pts = [[x, y, a]];
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    let da = e.curl / n;
    if (z.lauf) da += (z.amp * 2 / n) * f * dsin(z.om * c.t - f * 2.4 + e.ph);
    if (z.haengt && f > 0.4) da += dir * 0.34;
    if (z.knick && i === 4) da += dir * 1.1;
    if (haken && f > 0.55) da += dir * haken;
    a += da; x += dcos(a) * L / n; y += dsin(a) * L / n;
    pts.push([x, y, a]);
  }
  return pts;
}

function strich(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }

// Blatt nach Harness: claude rund (gefuellte Linse) · codex schmal (ein Strich) · pi gefiedert.
function blatt(ctx, h, x, y, a, len, col) {
  const P = rahmen(x, y, a);
  const [tx, ty] = P(len, 0);
  if (h === "claude") {
    const [l1x, l1y] = P(len * 0.5, -len * 0.42), [l2x, l2y] = P(len * 0.5, len * 0.42);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(l1x, l1y, tx, ty); ctx.quadraticCurveTo(l2x, l2y, x, y);
    ctx.fillStyle = col.blatt; ctx.fill();
  } else if (h === "codex") {
    const [mx, my] = P(len * 0.55, -len * 0.12);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ...P(len * 1.15, 0));
    ctx.strokeStyle = col.blatt; ctx.lineWidth = 0.9; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty);
    for (const f of [0.45, 0.8]) {
      const [bx, by] = P(len * f, 0);
      ctx.moveTo(bx, by); ctx.lineTo(...P(len * f + len * 0.2, -len * 0.3));
      ctx.moveTo(bx, by); ctx.lineTo(...P(len * f + len * 0.2, len * 0.3));
    }
    ctx.strokeStyle = col.blatt; ctx.lineWidth = 0.75; ctx.stroke();
  }
}

// Stiel und Blaetter, gemeinsam fuer Bluete und Samenstand
function kraut(ctx, c, e, z, col, L, haken) {
  const pts = stiel(c, e, z, L, haken);
  ctx.beginPath(); strich(ctx, pts);
  ctx.strokeStyle = col.stiel; ctx.lineWidth = c.s >= 40 ? 1.6 : e.k < 0.8 ? 0.8 : 1; ctx.stroke();
  const len = c.s * 0.2 * e.k;
  const wind = z.lauf ? 0.25 * z.amp * dsin(z.om * c.t + e.ph + 1) : 0;
  let anzahl = e.blatt;
  if (z.haengt) anzahl = Math.min(anzahl, 1);         // schlafend: die Blaetter sind abgefallen
  if (e.rosette) {
    for (let j = 0; j < anzahl; j++) {
      const s = j % 2 ? 1 : -1, w = -PI / 2 + s * (1.05 + (j >> 1) * 0.42) + wind;
      blatt(ctx, c.harness, pts[0][0], pts[0][1] - 0.5, w, len * (j < 2 ? 1 : 0.8), col);
    }
  } else {
    for (let j = 0; j < anzahl; j++) {
      const p = pts[2 + j * 2] ?? pts[2], s = (j % 2 ? -1 : 1) * e.seite;
      blatt(ctx, c.harness, p[0], p[1], p[2] + s * 0.95 + wind, len, col);
    }
  }
  return pts;
}

// === Fassung A · Bluete ========================================================================
// Eine Umrisszeichnung: Stiel, Blaetter, eine Bluete. Die Art ist die Bluetenform.
const BLUETE = [
  function tulpe(ctx, P, R, o, col) {
    const w = R * (0.28 + 0.5 * o);
    ctx.beginPath(); ctx.moveTo(...P(0, 0));
    ctx.quadraticCurveTo(...P(R * 0.2, -w * 1.25), ...P(R * 1.45, -w));
    ctx.lineTo(...P(R * 1.0, -w * 0.35)); ctx.lineTo(...P(R * 1.6, 0)); ctx.lineTo(...P(R * 1.0, w * 0.35));
    ctx.lineTo(...P(R * 1.45, w)); ctx.quadraticCurveTo(...P(R * 0.2, w * 1.25), ...P(0, 0));
    ctx.fillStyle = col.flaeche; ctx.fill(); ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.9; ctx.stroke();
  },
  function margerite(ctx, P, R, o, col, e) {
    const [cx, cy] = P(R * 0.95, 0), n = 11, r0 = R * 0.3, r1 = R * (0.55 + 0.6 * o);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const w = e.rot + i * 2 * PI / n;
      ctx.moveTo(cx + dcos(w) * r0, cy + dsin(w) * r0); ctx.lineTo(cx + dcos(w) * r1, cy + dsin(w) * r1);
    }
    ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.26, 0, 2 * PI); ctx.fillStyle = col.kopf; ctx.fill();
  },
  function glocke(ctx, P, R, o, col) {
    const w = R * (0.3 + 0.45 * o);
    ctx.beginPath(); ctx.moveTo(...P(0, -R * 0.22));
    ctx.quadraticCurveTo(...P(R * 0.9, -R * 0.3), ...P(R * 1.3, -w * 1.25));
    ctx.lineTo(...P(R * 1.3, w * 1.25));
    ctx.quadraticCurveTo(...P(R * 0.9, R * 0.3), ...P(0, R * 0.22)); ctx.closePath();
    ctx.fillStyle = col.flaeche; ctx.fill(); ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.beginPath(); ctx.arc(...P(R * 1.55, 0), R * 0.14, 0, 2 * PI); ctx.fillStyle = col.kopf; ctx.fill();
  },
  function stern(ctx, P, R, o, col, e) {
    const [cx, cy] = P(R * 0.95, 0), ra = R * (0.55 + 0.55 * o), ri = ra * 0.4;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const w = e.rot + i * PI / 5, rr = i % 2 ? ri : ra;
      i ? ctx.lineTo(cx + dcos(w) * rr, cy + dsin(w) * rr) : ctx.moveTo(cx + dcos(w) * rr, cy + dsin(w) * rr);
    }
    ctx.closePath(); ctx.fillStyle = col.flaeche; ctx.fill(); ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.9; ctx.stroke();
  },
  function mohn(ctx, P, R, o, col, e) {
    const [cx, cy] = P(R * 0.95, 0), d = R * (0.22 + 0.3 * o), r = R * (0.3 + 0.2 * o);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const w = e.rot + i * PI / 2, px = cx + dcos(w) * d, py = cy + dsin(w) * d;
      ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 2 * PI);
    }
    ctx.fillStyle = col.flaeche; ctx.fill(); ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.17, 0, 2 * PI); ctx.fillStyle = col.kopf; ctx.fill();
  },
  function winde(ctx, P, R, o, col) {
    const w = R * (0.3 + 0.62 * o);
    ctx.beginPath(); ctx.moveTo(...P(0, -R * 0.14)); ctx.lineTo(...P(R * 1.35, -w));
    ctx.quadraticCurveTo(...P(R * 1.7, 0), ...P(R * 1.35, w)); ctx.lineTo(...P(0, R * 0.14)); ctx.closePath();
    ctx.fillStyle = col.flaeche; ctx.fill(); ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...P(R * 1.35, -w)); ctx.quadraticCurveTo(...P(R * 1.05, 0), ...P(R * 1.35, w));
    ctx.lineWidth = 0.6; ctx.stroke();
  },
  function distel(ctx, P, R, o, col, e) {
    const [cx, cy] = P(R * 1.0, 0), rb = R * 0.42, rs = R * (0.6 + 0.45 * o);
    ctx.beginPath(); ctx.moveTo(...P(R * 0.1, 0)); ctx.lineTo(...P(R * 0.62, -R * 0.42));
    ctx.moveTo(...P(R * 0.1, 0)); ctx.lineTo(...P(R * 0.62, R * 0.42));
    for (let i = 0; i < 9; i++) {
      const w = e.rot + i * 2 * PI / 9;
      ctx.moveTo(cx + dcos(w) * rb, cy + dsin(w) * rb); ctx.lineTo(cx + dcos(w) * rs, cy + dsin(w) * rs);
    }
    ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.75; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rb, 0, 2 * PI); ctx.fillStyle = col.flaeche; ctx.fill();
    ctx.lineWidth = 0.9; ctx.stroke();
  },
  function rose(ctx, P, R, o, col, e) {
    const [cx, cy] = P(R * 0.95, 0), ra = R * (0.5 + 0.35 * o);
    ctx.beginPath(); ctx.arc(cx, cy, ra, 0, 2 * PI); ctx.fillStyle = col.flaeche; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const f = i / 28, w = e.rot + f * 4 * PI, rr = ra * f;
      i ? ctx.lineTo(cx + dcos(w) * rr, cy + dsin(w) * rr) : ctx.moveTo(cx, cy);
    }
    ctx.strokeStyle = col.kopf; ctx.lineWidth = 0.85; ctx.stroke();
  },
];

const Bluete = {
  id: "bluete",
  paint(ctx, c, z, col) {
    for (const e of c.ex) {
      const R = c.s * 0.19 * e.k;
      const pts = kraut(ctx, c, e, z, col, c.s * e.h - R * (c.art === 2 ? 0.4 : 1.5));
      let [x, y, a] = pts[pts.length - 1];
      if (c.art === 2) {                           // Glocke: ein Bogen am Stielende, die Bluete haengt
        const s = e.lean >= 0 ? 1 : -1, hx = x + s * R * 0.9, hy = y + R * 0.15;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * R * 0.2, y - R * 0.7, hx, hy);
        ctx.strokeStyle = col.stiel; ctx.lineWidth = 0.9; ctx.stroke();
        x = hx; y = hy; a = PI / 2 - s * (z.haengt ? -0.6 : 0.15);
      }
      const P = rahmen(x, y, a);
      if (z.verblueht) {                           // fertig: die Blaetter sind ab, der Fruchtknoten steht
        ctx.beginPath(); ctx.arc(...P(R * 0.45, 0), R * 0.3, 0, 2 * PI); ctx.fillStyle = col.kopf; ctx.fill();
        continue;
      }
      BLUETE[c.art](ctx, P, R, z.offen, col, e);
    }
  },
};

// === Fassung B · Zweig =========================================================================
// Eine Wuchsregel je Art, gezeichnet mit der Schildkroete. Das ist die "gewisse Logik", die der
// Owner an B · Automat aus Runde 3 mochte: man sieht die Regel (Fieder, Etage, Gabel, Bogen) und den
// Wind, der als Welle von der Wurzel zur Spitze durch sie hindurchlaeuft.
function zweigWind(c, e, z, f) { return z.lauf ? (z.amp * 0.5) * f * dsin(z.om * c.t - f * 2.4 + e.ph) : 0; }

function achse(ctx, c, e, z, x, y, a, L, n, krumm, f0 = 0, steif = 1) {
  const pts = [[x, y, a]], dir = e.lean >= 0 ? 1 : -1;
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

const ZWEIG = [
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
      const k = (j - 2), len = L * (0.6 + 0.4 * hash(j, c.seed));
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
    const gabel = (px, py, a, len, d, f) => {
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
  function kaktus(ctx, c, e, z, x, y, L, spitzen, col) {
    // der einzige Umriss: eine dicke Linie, innen ausgespart. Der Kaktus ist steif — der Wind biegt ihn
    // kaum (steif 0,25), und das ist botanisch richtig, nicht ein Sonderfall.
    ctx.stroke(); ctx.beginPath();
    const w = c.s * 0.15 * e.k, arm = [];
    const ax = achse(ctx, c, e, z, x, y, -PI / 2 + e.lean * 0.2, L * 0.9, 4, () => 0, 0, 0.25);
    const s = e.seite, [ax1, ay1] = ax[2];
    const ex = ax1 + s * c.s * 0.17 * e.k, ey = ay1 - (z.haengt ? -c.s * 0.1 : c.s * 0.2) * e.k;
    ctx.moveTo(ax1, ay1); ctx.lineTo(ex, ay1); ctx.lineTo(ex, ey); arm.push([ex, ey, -PI / 2]);
    if (e.n > 0.5) {
      const [bx1, by1] = ax[3], fx = bx1 - s * c.s * 0.13 * e.k;
      ctx.moveTo(bx1, by1); ctx.lineTo(fx, by1); ctx.lineTo(fx, by1 - c.s * 0.12 * e.k); arm.push([fx, by1 - c.s * 0.12 * e.k, -PI / 2]);
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = w; ctx.strokeStyle = col.kopf; ctx.stroke();
    ctx.lineWidth = Math.max(0.6, w - 2); ctx.strokeStyle = "#000"; ctx.stroke();
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
    // L-System F -> F[+F]F[-F]F, Tiefe 2: neun Glieder auf der Hauptachse
    const seg = L / 9, th = 0.46;
    const F = (px, py, a, d, f) => {
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

const Zweig = {
  id: "zweig",
  paint(ctx, c, z, col) {
    for (const e of c.ex) {
      const x = c.x + c.s * e.bx, y = c.y + c.s - 1.5, L = c.s * e.h * 0.92, spitzen = [];
      ctx.beginPath();
      ZWEIG[c.art](ctx, c, e, z, x, y, L, spitzen, col);
      ctx.strokeStyle = col.kopf; ctx.lineWidth = c.s >= 40 ? 1.3 : e.k < 0.8 ? 0.7 : 0.85; ctx.stroke();
      // die Knospen tragen das Harness; fertig heisst: keine Knospen mehr, schlafend auch nicht
      if (z.verblueht || z.haengt || c.harness === "codex") continue;
      const r = c.s * 0.045 * e.k + 0.35;
      ctx.beginPath();
      for (const [px, py, pa] of spitzen) {
        if (c.harness === "claude") { ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 2 * PI); }
        else {
          ctx.moveTo(px, py); ctx.lineTo(px + dcos(pa - 0.6) * r * 2.4, py + dsin(pa - 0.6) * r * 2.4);
          ctx.moveTo(px, py); ctx.lineTo(px + dcos(pa + 0.6) * r * 2.4, py + dsin(pa + 0.6) * r * 2.4);
        }
      }
      if (c.harness === "claude") { ctx.fillStyle = col.hell; ctx.fill(); }
      else { ctx.strokeStyle = col.hell; ctx.lineWidth = 0.8; ctx.stroke(); }
    }
  },
};

// === Fassung C · Samenstand ====================================================================
// Punkte statt Linien — die Sprache der Flakes (src/flakes.ts: weisse Punkte auf Schwarz). Die
// Flakes der Chat-Ansicht WERDEN hier zu Samen: arbeitend loesen sich Samen vom Kopf und treiben
// davon, und ihr Platz im Kopf ist leer, solange sie fliegen. Ruhend ist der Kopf voll und still.
// Die Punktlagen sind im lokalen Rahmen der Spitze, einmal je Zelle gerechnet.
function kopfPunkte(art, R, e) {
  const p = [];
  if (art === 0) { for (let i = 0; i < 14; i++) { const w = e.rot + i * 2 * PI / 14; p.push([R + dcos(w) * R * 0.95, dsin(w) * R * 0.95]); } }
  else if (art === 1) {
    for (let i = 0; i < 6; i++) {
      const w = -0.95 + i * 0.38, ex = dcos(w) * R * 1.35, ey = dsin(w) * R * 1.35;
      p.push([ex, ey], [ex + R * 0.16, ey - R * 0.16], [ex + R * 0.16, ey + R * 0.16]);
    }
  } else if (art === 2) { for (let i = 0; i < 7; i++) p.push([-i * R * 0.3, (i % 2 ? 1 : -1) * R * 0.28], [-i * R * 0.3 - R * 0.12, (i % 2 ? -1 : 1) * R * 0.28]); }
  else if (art === 3) {                     // Rispe: Aeste steigen kurz und neigen sich dann ueber
    for (let j = 0; j < 4; j++) {
      const s = j % 2 ? 1 : -1, base = -j * R * 0.35;
      for (let i = 1; i <= 4; i++) { const f = i / 4; p.push([base + f * R * 0.55 - f * f * R * 1.1, s * f * R * 1.05]); }
    }
  } else if (art === 4) { for (let i = 1; i <= 24; i++) { const rr = R * 0.95 * Math.sqrt(i / 24), w = i * GOLD + e.rot; p.push([R + dcos(w) * rr, dsin(w) * rr]); } }
  else if (art === 5) { for (let i = 0; i < 7; i++) for (const q of [-1, 0, 1]) p.push([-i * R * 0.24, q * R * 0.24]); }
  else if (art === 6) {                     // Traube: haengt senkrecht, im Rahmen der Schwerkraft (s. paint)
    for (let i = 0; i < 5; i++) { const n = 4 - Math.floor(i * 0.75); for (let k = 0; k < n; k++) p.push([R * 0.25 + i * R * 0.34, (k - (n - 1) / 2) * R * 0.36]); }
  }
  else { for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) { const w = i * PI / 3 + j * 0.5; p.push([-j * R * 0.75 + dsin(w) * R * 0.18, dcos(w) * R * (0.7 - j * 0.14)]); } }
  return p;
}

const Samen = {
  id: "samen",
  init(c) {
    for (const e of c.ex) {
      e.R = c.s * 0.2 * e.k;
      e.punkte = kopfPunkte(c.art, e.R, e);
      // schlafend fehlt die Haelfte, fertig bleiben drei — die Luecken aus dem Index, kein Wuerfel
      e.schlaf = e.punkte.map((_, i) => hash(i, c.seed) < 0.5);
      e.fertig = e.punkte.map((_, i) => i % Math.max(1, Math.floor(e.punkte.length / 3)) === 0);
    }
  },
  paint(ctx, c, z, col) {
    for (const e of c.ex) {
      const R = e.R;
      const pts = kraut(ctx, c, e, z, col, c.s * e.h - R * ([2, 3, 5, 7].includes(c.art) ? 0.1 : c.art === 6 ? 0.2 : 1.7), c.art === 6 ? 0.3 : 0);
      const [x, y, a] = pts[pts.length - 1];
      const P = c.art === 6 ? rahmen(x, y, PI / 2) : rahmen(x, y, a);
      // Flug: drei Samen, zeitbestimmt, nicht zustandsbehaftet — Ort = f(t), sonst driftet es ueber Stunden
      const weg = new Set(), flug = [];
      if (z.lauf && !z.red && e === c.ex[0]) {
        const per = 2.8, dauer = 2.0;
        for (let k = 0; k < 3; k++) {
          const u = c.t + k * per / 3 + e.ph, zyk = Math.floor(u / per), tau = u - zyk * per;
          if (tau >= dauer) continue;
          const j = Math.floor(hash(zyk * 3 + k, c.seed) * e.punkte.length);
          weg.add(j);
          const [sx, sy] = P(...e.punkte[j]);
          flug.push([sx + tau * c.s * 0.34, sy - tau * c.s * 0.2 + dsin(tau * 5 + k) * c.s * 0.03, 1 - tau / dauer]);
        }
      }
      if (c.art === 0 && !z.verblueht) {           // die Pusteblume hat Strahlen, sonst ist sie ein Kreis
        ctx.beginPath();
        e.punkte.forEach((q, i) => { if (!weg.has(i) && !(z.haengt && !e.schlaf[i])) { ctx.moveTo(...P(R, 0)); ctx.lineTo(...P(...q)); } });
        ctx.strokeStyle = col.flaeche; ctx.lineWidth = 0.5; ctx.stroke();
      }
      if (c.art === 1 || c.art === 3) {            // Dolde und Rispe: die Strahlen tragen die Punkte
        ctx.beginPath();
        if (c.art === 1) for (let i = 0; i < e.punkte.length; i += 3) { ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(...e.punkte[i])); }
        else for (let i = 0; i < e.punkte.length; i += 4) { ctx.moveTo(...P(-Math.floor(i / 4) * R * 0.35, 0)); for (let m = 0; m < 4; m++) ctx.lineTo(...P(...e.punkte[i + m])); }
        ctx.strokeStyle = col.stiel; ctx.lineWidth = 0.5; ctx.stroke();
      }
      const r = c.s >= 40 ? 1.1 : 0.62;
      ctx.beginPath();
      e.punkte.forEach((q, i) => {
        if (weg.has(i) || (z.haengt && !e.schlaf[i]) || (z.verblueht && !e.fertig[i])) return;
        let [px, py] = P(...q);
        if (z.red) { px += dsin(c.t * 23 + i * 1.7) * 0.9; py += dcos(c.t * 19 + i * 2.3) * 0.9; }
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 2 * PI);
      });
      ctx.fillStyle = col.hell; ctx.fill();
      for (const [fx, fy, al] of flug) {
        ctx.beginPath(); ctx.arc(fx, fy, r, 0, 2 * PI); ctx.fillStyle = col.flug(al); ctx.fill();
      }
    }
  },
};

export const FASSUNGEN = { bluete: Bluete, zweig: Zweig, samen: Samen };

// === Die Buehne: EINE Canvas je Leiste, EIN rAF — Bauform src/flakes.ts und marken3.js ========
// Anders als in Runde 3 akkumuliert hier nichts: eine laufende Zelle wird je Bild geleert und neu
// gezeichnet, eine stehende einmal. Deshalb braucht Ruhe keinen Trick — sie ist ein Bild, das nicht
// neu gemalt wird.
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)");

export class PflanzStage {
  constructor(canvas, opt = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dprFest = opt.dpr;
    this.cells = [];
    this.raf = 0; this.last = 0; this.on = true;
    this.frames = 0; this.t0 = 0; this.fps = 0;
    this._wake = () => this.sync();
    document.addEventListener("visibilitychange", this._wake);
    REDUCE.addEventListener("change", this._wake);
  }

  // rows: [{ x, y, size, repo, harness, rolle, seed, state, fassung }]
  setRows(rows, cssW, cssH) {
    const dpr = this.dprFest ?? Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, cssW, cssH);
    this.cells = rows.map((r) => this.bau(r));
    this.sync();
  }

  bau(r) {
    const c = {
      x: r.x, y: r.y, s: r.size, t: 0, state: r.state, ident: r,
      seed: r.seed, art: artOf(r.repo), hue: projectHue(r.repo ?? ""), harness: harnessOf(r.harness),
      fassung: FASSUNGEN[r.fassung] ?? Bluete, painted: false,
    };
    c.ex = exemplare(c.seed, r.rolle);
    c.fassung.init?.(c);
    return c;
  }

  get anyAlive() { return this.cells.some((c) => (ZUSTAND[c.state] ?? ZUSTAND.rest).lauf); }

  sync() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const c of this.cells) c.painted = false;
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
      const z = ZUSTAND[c.state] ?? ZUSTAND.rest;
      if (c.painted && !z.lauf) continue;
      c.painted = true;
      c.t += dt;
      ctx.save();
      ctx.beginPath(); ctx.rect(c.x, c.y, c.s, c.s); ctx.clip();
      ctx.fillStyle = "#000"; ctx.fillRect(c.x, c.y, c.s, c.s);
      if (z.leer) this.paintFree(ctx, c);
      else c.fassung.paint(ctx, c, z, farben(c, z));
      if (z.beacon) this.paintBeacon(ctx, c, z);
      ctx.restore();
    }
  }

  // Ein freier Platz: nackte Erde. Eine Linie, keine Pflanze — sie haelt die Achse der Spalte.
  paintFree(ctx, c) {
    ctx.beginPath(); ctx.moveTo(c.x + c.s * 0.25, c.y + c.s - 1.5); ctx.lineTo(c.x + c.s * 0.75, c.y + c.s - 1.5);
    ctx.strokeStyle = "hsl(0 0% 26%)"; ctx.lineWidth = 1; ctx.stroke();
  }

  // `need` wartet auf den Owner: derselbe atmende Rahmen wie in Runde 3, der einzige Zustand am Rand
  paintBeacon(ctx, c, z) {
    const a = 0.25 + 0.4 * (0.5 + 0.5 * dsin(c.t * 2.2));
    ctx.strokeStyle = `hsl(${c.hue} 58% ${z.light + 12}% / ${a})`; ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x + 0.75, c.y + 0.75, c.s - 1.5, c.s - 1.5);
  }

  bench(passes = 90) {
    for (let i = 0; i < 12; i++) this.paintAll(1 / 60);
    const t0 = performance.now();
    for (let i = 0; i < passes; i++) this.paintAll(1 / 60);
    const ms = (performance.now() - t0) / passes;
    const alive = this.cells.filter((c) => (ZUSTAND[c.state] ?? ZUSTAND.rest).lauf).length;
    return { ms, alive, total: this.cells.length, share: ms * 60 / 10 };
  }
}

// Ein Farbton je Marke, nur Helligkeit variiert (Runde 3, aus dem Bericht). Schlafend grau, Fehler rot.
function farben(c, z) {
  const hue = z.red ? 2 : c.hue, sat = z.gray ? 0 : z.red ? 70 : 58, L = z.light;
  const h = (l, a = 1) => `hsl(${hue} ${sat}% ${Math.max(6, Math.min(94, l))}% / ${a})`;
  return {
    stiel: h(L - 16), blatt: h(L - 6), kopf: h(L + 8), hell: h(L + 18), flaeche: h(L - 26, 0.7),
    flug: (a) => h(L + 18, a),
  };
}

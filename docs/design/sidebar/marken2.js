// Runde 2 der Session-Marke. Dieselben Fakten wie in `marken.js`, anderes Traggeruest: die Marke ist
// hier ZUERST ein Zifferblatt und erst danach ein Erkennungszeichen. Der Unterschied ist nicht
// Geschmack, er folgt aus acht Befunden am gerenderten Bild von Runde 1 (`c16-marke-a.png`) —
// welcher Befund welchen Kanal bewegt hat, steht an dem Kanal.
//
//   Farbton      = Projekt            projectHue(repo), acht Toene, unveraendert uebernommen
//   Tonstufe     = Slot + openedAt    Helligkeit/Saettigung/Hue-Versatz INNERHALB des Projekttons  [B2]
//   Strichart    = Harness            auf der SPUR: claude voll · codex Striche · pi Punkte       [B1]
//   Bogen        = Kontext-Prozent    0..100 %, von 12 Uhr im Uhrzeigersinn, immer durchgezogen    [B4]
//   Zentrum      = Adresse            MAIN die Slot-Zahl, Lane ihr Buchstabe                       [B5]
//   Spur         = Rolle              MAIN geschlossener Kreis · Lane unten offen · frei nur Spur  [B6]
//   Zustand      = Chroma + Bewegung  ruhend farbig/still, schlafend GRAU, wartend invertiert      [B7]
//
// Ohne Farbe bleibt die Marke lesbar: Strichart, Bogenlaenge, Zentrumszeichen und die offene Spur
// tragen alle ohne einen einzigen Farbwert.

import { projectHue, family, seedOf } from "./marken.js";
export { projectHue, family, seedOf, MarkTicker } from "./marken.js";

// [B2] Fast alles war lila, weil fast alles dasselbe Repo ist. Fuenf Tonstufen INNERHALB des
// Projekttons: der Hue wandert hoechstens 8 Grad (die acht Projekttoene liegen 30-55 Grad
// auseinander, also bleibt die Zugehoerigkeit erhalten), Helligkeit und Saettigung tragen den Rest.
const TONE = [
  { dh: -8, dl: -9, ds: -12 },
  { dh: -3, dl: -4, ds:  -5 },
  { dh:  0, dl:  0, ds:   0 },
  { dh:  4, dl:  6, ds:   6 },
  { dh:  8, dl: 12, ds:  10 },
];
export function toneOf(seed) { return TONE[Math.min(4, Math.floor(seed * 5))]; }

// [B7] Zwei Zustaende, zwei MITTEL — nicht zweimal dieselbe Dimmung. `rest` behaelt den Projektton
// und steht still; `sleep` verliert die Farbe (chroma 0) und behaelt dafuer genug Helligkeit, um
// ueberhaupt noch da zu sein. `need` ist der Zustand, den Runde 1 gar nicht zeichnen konnte
// (STATE kannte vier, die Daten tragen sechs) — und es ist der einzige, der den Owner braucht.
const STATE = {
  work:  { sat: 68, light: 60, track: 0.30, arc: 1,    ink: 0.98, gray: false, moves: "head"  },
  need:  { sat: 74, light: 66, track: 0.34, arc: 1,    ink: 0.98, gray: false, moves: "breath", invert: true },
  rest:  { sat: 46, light: 54, track: 0.24, arc: 0.85, ink: 0.72, gray: false, moves: null    },
  done:  { sat: 30, light: 48, track: 0.20, arc: 0.55, ink: 0.55, gray: false, moves: null, full: true },
  // `thin` ist das ZWEITE Mittel fuer schlafend. Chroma allein trennt ruhend/schlafend nur, solange
  // es Farbe gibt — in Graustufen (und fuer jeden, der Rot-Gruen nicht trennt) fiel der Unterschied
  // im gerenderten Bild wieder zusammen. Ein duennerer Strich faellt nicht mit der Farbe weg.
  sleep: { sat:  0, light: 46, track: 0.16, arc: 0.42, ink: 0.42, gray: true,  moves: null, thin: 0.5 },
  bad:   { sat: 72, light: 62, track: 0.46, arc: 1,    ink: 1,    gray: false, moves: "pulse", hue: 2, alarm: true },
  free:  { sat:  0, light: 34, track: 0.16, arc: 0,    ink: 0.30, gray: true,  moves: null    },
};
export const STATES = Object.keys(STATE);

const TAU = Math.PI * 2, TOP = -Math.PI / 2;

// Ein Zeichen in einen 2D-Kontext. size = CSS-Pixel, phase = 0..1 (nur fuer Bewegung).
// o: { size, hue, fam, seed, state, role, pct, addr }
export function drawMark2(ctx, o) {
  const size = o.size, st = STATE[o.state] ?? STATE.rest, tone = toneOf(o.seed ?? 0);
  const ph = st.moves ? (o.phase ?? 0) : 0;
  const c = size / 2;
  const w = Math.max(1.6, size * 0.105) * (st.thin ?? 1);   // Strichstaerke der Spur und des Bogens
  const r = c - w / 2 - size * 0.055;               // Radius der Spur
  const hue = st.hue ?? ((o.hue ?? 260) + tone.dh + 360) % 360;
  const sat = st.gray ? 0 : Math.max(0, st.sat + tone.ds);
  const col = (l, a) => `hsl(${hue} ${sat}% ${Math.max(6, Math.min(92, l))}% / ${a})`;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.lineCap = "butt";

  // [B3] Keine gefuellte Rundkachel mehr. Die Marke sitzt auf dem reinen Grund der Leiste; was den
  // Platz haelt, ist die SPUR — ein voller, sehr dunkler Kreis, den es auch auf einem freien Platz
  // gibt. [B6] Damit bekommt die Spalte keine Loecher: die Achse steht, auch wo keine Session ist.
  // [B1, zweiter Durchgang] Die Spur traegt die Strichart des Harness, nicht der Bogen. Der erste
  // Entwurf legte sie auf den Bogen — im gerenderten Bild war sie damit bei jeder Session unter
  // etwa 25 % Kontext unsichtbar (Slot 1 mit 18 % zeigte zwei Striche, Slot 5 mit 58 % sechs). Die
  // Spur ist IMMER vollstaendig, also ist das Harness immer ablesbar, auch bei 6 %.
  ctx.lineWidth = w;
  ctx.strokeStyle = col(st.light - 22, st.track);
  const trackEnd = TOP + (o.role === "lane" ? 0.78 : 1) * TAU;
  arcStyled(ctx, c, r, TOP, trackEnd, o.fam, size);

  // [B4] Der Bogen IST der Fuellstand. Er faengt oben an und laeuft im Uhrzeigersinn; 100 % ist der
  // geschlossene Kreis. Ein Platz ohne gemeldeten Kontext (eine frische Task-Lane) zeigt keinen
  // Bogen — nicht null Prozent, sondern kein Wert, und das ist ein Unterschied.
  const pct = o.state === "free" ? null : o.pct;
  if (pct != null || st.full) {
    const frac = st.full ? 1 : Math.max(0.03, Math.min(1, pct / 100));
    const span = (o.role === "lane" ? 0.78 : 1) * frac * TAU;   // die Lane-Spur ist kuerzer, der Bogen auch
    ctx.lineWidth = w;
    ctx.strokeStyle = col(st.light, st.arc);
    ctx.beginPath(); ctx.arc(c, c, r, TOP, TOP + span); ctx.stroke();

    // [B7-work] Nur das ARBEITEN bewegt sich, und nur auf dem eigenen Bogen: ein heller Kopf laeuft
    // von 12 Uhr bis zum Fuellstand und faengt von vorn an. Kein zweites Leuchten, keine Flaeche.
    if (st.moves === "head" && span > 0.08) {
      const a = TOP + span * ((ph * 1) % 1);
      ctx.lineWidth = w;
      ctx.strokeStyle = col(st.light + 24, 1);
      ctx.beginPath(); ctx.arc(c, c, r, a - 0.22, a); ctx.stroke();
    }
  }

  // [B7-need] Wartet die Session auf den Owner, atmet ein zweiter Ring AUSSERHALB der Spur. Er ist
  // das einzige Mittel, das ueber den Rand der Marke hinausgeht — deshalb faellt er in einer Spalte
  // aus neunzehn Marken auf, ohne dass irgendetwas heller wird.
  if (st.moves === "breath") {
    const a = 0.16 + 0.26 * (0.5 + 0.5 * Math.sin(ph * TAU));
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.strokeStyle = col(st.light + 10, a);
    ctx.beginPath(); ctx.arc(c, c, r + w * 0.85, 0, TAU); ctx.stroke();
  }
  // [B7-bad] Rot ist der einzige Zustand mit ZWEI Ringen: der aeussere pulst, der innere steht. Das
  // Doppelte traegt auch in Graustufen, wo Rot nichts mehr sagt — `need` atmet einfach, `bad` atmet
  // und ist doppelt. Ein zerrissener Bogen war der erste Versuch; er las sich bei 18 % als zwei
  // Anfuehrungszeichen ueber der Zahl, also ist er verworfen.
  if (st.alarm) {
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.strokeStyle = col(st.light + 8, 0.28 + 0.4 * Math.sin(ph * TAU * 2));
    ctx.beginPath(); ctx.arc(c, c, r + w * 0.85, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col(st.light - 4, 0.75);
    ctx.beginPath(); ctx.arc(c, c, r - w * 0.95, 0, TAU); ctx.stroke();
  }

  // [B5] Die Adresse steht IM Zeichen, nicht daneben. MAIN traegt ihre Slot-Zahl, eine Lane nur
  // ihren Buchstaben — ihr Band steht schon in der Einrueckung und in der Schiene der Gruppe, und
  // ein Zeichen ist bei 21 px lesbar, wo zwei es nicht mehr sind.
  const addr = o.addr ?? "";
  if (addr) {
    const fs = size * (addr.length > 1 ? 0.38 : 0.46);
    ctx.font = `600 ${fs.toFixed(2)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (st.invert) {
      ctx.fillStyle = col(st.light, 1);
      ctx.beginPath(); ctx.arc(c, c, r - w * 0.9, 0, TAU); ctx.fill();
      ctx.fillStyle = "#08080a";
    } else {
      ctx.fillStyle = st.gray ? `hsl(0 0% ${st.light + 14}% / ${st.ink})` : col(st.light + 26, st.ink);
    }
    ctx.fillText(addr, c, c + size * 0.015);
  }
  ctx.restore();
}

// [B1] Das Harness sitzt in der STRICHART der Spur statt in einer eigenen Musterfamilie. Damit
// bleibt der Satz aus Runde 1 erhalten (claude Ringe, codex Zeilen, pi Gitter), aber alle drei
// Harnesses teilen sich EINE Form — und der Freiheitsgrad je Session wird dadurch frei, dass
// Bogenlaenge, Tonstufe und Zentrumszeichen jetzt je Session verschieden sind. Die Rolle steckt in
// der LAENGE der Spur: MAIN ein geschlossener Kreis, eine Lane unten offen.
function arcStyled(ctx, c, r, a0, a1, fam, size) {
  const seg = (s, e) => { ctx.beginPath(); ctx.arc(c, c, r, s, e); ctx.stroke(); };
  if (fam === "rings") { seg(a0, a1); return; }                       // claude: durchgezogen
  const dash = fam === "lines" ? size * 0.17 : size * 0.055;          // codex: Striche · pi: Punkte
  const gap  = fam === "lines" ? size * 0.10 : size * 0.085;
  if (fam === "grid") ctx.lineCap = "round";
  const stepA = (dash + gap) / r, dashA = dash / r;
  for (let a = a0; a < a1 - dashA * 0.4; a += stepA) seg(a, Math.min(a1, a + dashA));
  ctx.lineCap = "butt";
}

// Wie `Mark` in marken.js, nur mit dem Zeichner dieser Runde. MarkTicker wird unveraendert
// wiederverwendet — er kennt nur `paint(phase)` und `moves`.
export class Mark2 {
  constructor(canvas, o) {
    this.o = o; this.canvas = canvas;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(o.size * dpr); canvas.height = Math.round(o.size * dpr);
    canvas.style.width = canvas.style.height = o.size + "px";
    this.ctx = canvas.getContext("2d"); this.ctx.scale(dpr, dpr);
  }
  get moves() { return !!(STATE[this.o.state] ?? {}).moves; }
  paint(phase) { drawMark2(this.ctx, { ...this.o, phase }); }
}

// Eine Zeile aus den Slot-Daten in die Form, die drawMark2 liest. Eine Stelle, damit A2 und die
// beiden Gegenentwuerfe garantiert dieselben Kanaele zeigen.
export function markOptions(s, size) {
  const lane = s.role === "lane";
  return {
    size,
    hue: s.free ? 0 : projectHue(s.repo),
    fam: s.free ? "rings" : family(s.harness),
    seed: s.free ? 0.5 : seedOf(s.slot, s.openedAt),
    state: s.free ? "free" : s.state,
    role: lane ? "lane" : "main",
    pct: s.pct ?? null,
    addr: lane ? String(s.slot).replace(/^\d+/, "") : String(s.slot),
  };
}

// ---------------------------------------------------------------------------------------------
// Gegenentwurf D · Kerbe. Dieselbe Scheibe wie A2, aber die beiden Kanaele im Inneren sind
// getauscht: das ZENTRUM traegt ein Projekt-Monogramm (zwei Zeichen aus dem Repo-Namen), und die
// ADRESSE wird zu einem ORT — eine Kerbe auf der Spur, an der Uhrzeit des Slots. Sechzehn Plaetze,
// sechzehn Stunden. Damit sagt die Marke in einem Blick, WELCHES Projekt, und die Nachbarschaft
// zweier Sessions liest sich an der Kerbstellung, nicht an einer Zahl, die man lesen muss.
// Die Frage, die D beantwortet: ist Identitaet bei 26 px besser als Schrift oder als Muster?
export function monogram(path) {
  const base = (path.split("/").pop() || "?").replace(/^[._]+/, "");
  const parts = base.split(/[-_. ]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toLowerCase();
  return base.slice(0, 2).toLowerCase();
}

export function drawMarkD(ctx, o) {
  const size = o.size, c = size / 2;
  // erst die Scheibe von A2 zeichnen, aber ohne Zentrumszeichen
  drawMark2(ctx, { ...o, addr: "" });
  const st = STATE[o.state] ?? STATE.rest, tone = toneOf(o.seed ?? 0);
  const w = Math.max(1.6, size * 0.105), r = c - w / 2 - size * 0.055;
  const hue = st.hue ?? ((o.hue ?? 260) + tone.dh + 360) % 360;
  const sat = st.gray ? 0 : Math.max(0, st.sat + tone.ds);
  ctx.save();
  // Kerbe = Adresse. Slot 1 steht auf 12 Uhr, dann im Uhrzeigersinn; eine Lane sitzt auf der
  // Stunde IHRES Bandes und traegt zusaetzlich ihren Buchstaben als zweite, kleinere Kerbe.
  const band = parseInt(String(o.addrSlot ?? 1), 10) || 1;
  const a = TOP + ((band - 1) % 16) / 16 * TAU;
  ctx.strokeStyle = `hsl(${hue} ${sat}% ${Math.min(92, st.light + 30)}% / ${st.ink})`;
  ctx.lineWidth = Math.max(1.4, size * 0.09); ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(c + Math.cos(a) * (r + w * 0.62), c + Math.sin(a) * (r + w * 0.62));
  ctx.lineTo(c + Math.cos(a) * (r + w * 1.5), c + Math.sin(a) * (r + w * 1.5));
  ctx.stroke();
  // Monogramm im Zentrum
  const mg = o.mono ?? "";
  if (mg) {
    ctx.font = `600 ${(size * 0.34).toFixed(2)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = st.gray ? `hsl(0 0% ${st.light + 14}% / ${st.ink})`
                            : `hsl(${hue} ${sat}% ${Math.min(92, st.light + 26)}% / ${st.ink})`;
    ctx.fillText(mg, c, c + size * 0.02);
  }
  ctx.restore();
}

export class MarkD extends Mark2 {
  paint(phase) { drawMarkD(this.ctx, { ...this.o, phase }); }
}

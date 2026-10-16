// K15 · DER REGLER „WIE VIEL FLEET MITKOMMT“ in Schritt 3 von „Deine Agent-MD“ (Teil 3; Owner 16.10.: „[Zitat entfernt]“
// ). Bauleitung f6edd1e7: die Rolle
// ist eine Vorschau („Vorschau als: Lane · MAIN“), getrennt vom Regler; der Regler gilt für die gewählte Rolle. Je Stufe liest das Fenster
// den Plan des Servers; was die Tür nicht einhält, nimmt die Stufe heraus (src/k15-anbindung.ts#bereinigt), so ist jede Stufe mit Rolle
// startbar und zeigt, was wirklich ankommt.
import type { Answer } from "./founding";
import { el, bausteinName } from "./k15-haupt";
import { ANBINDUNGEN, IMMER, anbindungSchalter, bereinigt, fleetTeil, unterschied, type Anbindung } from "./k15-anbindung";
import type { Schalter } from "./k15-entwurf-modell";
import { antwort, fehltWeil, grundWort, hole, planUrl, render, type St } from "./k15-zustand";

export type Vorschau = "lane" | "main";
export const VORSCHAU: readonly { id: Vorschau; wort: string }[] = [{ id: "lane", wort: "Lane" }, { id: "main", wort: "MAIN" }];
// die Graustufe je Stufe, von hell nach dunkel: gefüllt bis zur gewählten, darüber nur angedeutet
const GRAU: readonly [number, number][] = [[5, 2], [12, 4], [21, 6], [32, 8]];

export interface StufenPlan { a: Answer | null; fehler: string | null; schalter: Schalter | null; abgelehnt: { id: string; grund: string }[] }
function lies(s: St, url: string): { a: Answer | null; fehler: string | null } {
  const st = hole(s, url);
  return { a: antwort(st), fehler: typeof st === "object" && "fehler" in st ? st.fehler : null };
}
// der Plan einer Stufe: „Nur Ordner“ ohne Rolle, „Standard“ der Plan der Rolle, „Pflicht“ und „Alles“ mit den Schaltern ihrer Stufe ohne die,
// die die Tür nicht einhält (dafür eine zweite Lesung)
export function stufenPlan(s: St, repo: string, rolle: Vorschau, st: Anbindung): StufenPlan {
  if (st === "ordner") return { ...lies(s, planUrl(repo, "nur-ordner", {})), schalter: {}, abgelehnt: [] };
  const voll = lies(s, planUrl(repo, rolle, {}));
  if (!voll.a || st === "standard") return { ...voll, schalter: voll.a ? {} : null, abgelehnt: [] };
  const roh = anbindungSchalter(st, voll.a);
  const erst = lies(s, planUrl(repo, rolle, roh));
  if (!erst.a) return { ...erst, schalter: null, abgelehnt: [] };
  const b = bereinigt(roh, erst.a);
  return { ...(b.abgelehnt.length ? lies(s, planUrl(repo, rolle, b.schalter)) : erst), schalter: b.schalter, abgelehnt: b.abgelehnt };
}
// schaltet „Alles“ nach dem Bereinigen nichts mehr dazu, ist es der Standard und keine eigene Stufe; der Regler zeigt es dann nicht
// (Bauleitung 2a2ec0d0: „Alles“ nur, wo es wirklich mehr bringt, also mit Karte; eine gesperrte Stufe „wie Standard“ ist Rauschen)
export const wieStandard = (st: Anbindung, p: StufenPlan): boolean => st === "alles" && p.schalter !== null && Object.keys(p.schalter).length === 0;

// was Fleet bei einer Stufe dazugibt, auf zehn gerundet; der Rest der Zahl („ Tok“) fällt auf dem Handy weg, die Erklärung steht darunter
function tokZeile(p: StufenPlan): HTMLElement {
  const z = el("span", "k15abrt");
  const f = p.a ? fleetTeil(p.a) : null;
  if (p.fehler) { z.textContent = "–"; z.title = p.fehler; }
  else if (!p.a) z.textContent = "…";
  else if (f && f.tokens > 0) z.append(`≈ ${(Math.round(f.tokens / 10) * 10).toLocaleString("de-DE")}`, el("span", "k15abru", " Tok"));
  else if (f) z.textContent = "nichts";
  return z;
}

export function vorschauWahl(a: { rolle: Vorschau }): HTMLElement {
  const z = el("div", "k15abvz");
  const seg = el("div", "k15seg k15abvs");
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", "Vorschau als");
  for (const x of VORSCHAU) {
    const b = el("button", a.rolle === x.id ? "on" : "", x.wort);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(a.rolle === x.id));
    b.onclick = () => { a.rolle = x.id; render(); };
    seg.append(b);
  }
  z.append(el("span", "k15abvk", "Vorschau als"), seg);
  return z;
}

export function regler(a: { stufe: Anbindung }, plaene: readonly StufenPlan[]): HTMLElement {
  const reg = el("div", "k15abreg");
  reg.setAttribute("role", "radiogroup");
  reg.setAttribute("aria-label", "Wie viel Fleet mitkommt");
  const i0 = ANBINDUNGEN.findIndex((x) => x.id === a.stufe);
  // „Alles“ erst, wenn feststeht, dass es mehr schaltet als der Standard
  const zeigt = (i: number): boolean => ANBINDUNGEN[i].id !== "alles" || (plaene[i]?.schalter != null && !wieStandard("alles", plaene[i]));
  reg.style.setProperty("--n", String(ANBINDUNGEN.filter((_, i) => zeigt(i)).length));
  ANBINDUNGEN.forEach((x, i) => {
    if (!zeigt(i)) return;
    const b = el("button", `${i <= i0 ? "voll" : ""}${i === i0 ? " on" : ""}`);
    b.dataset.stufe = x.id;
    b.style.setProperty("--g", `${GRAU[i][0]}%`);
    b.style.setProperty("--g0", `${GRAU[i][1]}%`);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(i === i0));
    b.title = x.satz;
    b.append(el("span", "k15abrw", x.wort), tokZeile(plaene[i]));
    b.onclick = () => { a.stufe = x.id; render(); };
    reg.append(b);
  });
  return reg;
}

const namen = (a: Answer, ids: readonly string[]): string =>
  ids.map((id) => { const b = a.plan.bausteine.find((x) => x.id === id); return b ? bausteinName(b) : id; }).join(", ");
const zeile = (k: string, v: string): HTMLElement => { const r = el("div", "k15abd"); r.append(el("span", "k15abdk", k), el("span", "k15abdv", v)); return r; };
// WAS DIE GEWÄHLTE STUFE ÄNDERT: gegenüber der darunter dazu und weg (die Tabelle hebt das Dazu hervor), was angeschaltet ist, bei diesem
// Start aber nicht ankommt, und was die Tür an dieser Stufe nicht einhält; über „Standard“ auch, was „Alles“ nicht bringen kann
export function aenderung(plaene: readonly StufenPlan[], i0: number): { dazu: Set<string>; zeilen: HTMLElement[] } {
  const oben = plaene[i0], unten = i0 > 0 ? plaene[i0 - 1] : null;
  const zeilen: HTMLElement[] = [];
  let dazu = new Set<string>();
  if (oben.a && unten?.a) {
    const d = unterschied(unten.a, oben.a);
    dazu = new Set(d.dazu);
    zeilen.push(zeile(`Gegenüber „${ANBINDUNGEN[i0 - 1].wort}“`,
      [d.dazu.length ? `dazu ${namen(oben.a, d.dazu)}` : "nichts dazu", ...(d.weg.length ? [`weg ${namen(unten.a, d.weg)}`] : [])].join(" · ")));
    const nachGrund = new Map<string, string[]>();
    for (const id of d.nichtJetzt) {
      const b = oben.a.plan.bausteine.find((x) => x.id === id);
      const g = b ? fehltWeil(oben.a, b) ?? "dieser Start liefert es nicht" : null;
      if (g) nachGrund.set(g, [...(nachGrund.get(g) ?? []), id]);
    }
    for (const [g, ids] of nachGrund) zeilen.push(zeile("An, kommt aber nicht an", `${namen(oben.a, ids)}: ${g}`));
  }
  const alles = plaene[i0 + 1];
  const nichtEin = [...oben.abgelehnt, ...(ANBINDUNGEN[i0].id === "standard" && alles && wieStandard("alles", alles) ? alles.abgelehnt : [])];
  const quelle = oben.a ?? alles?.a;
  const immer = nichtEin.filter((x) => x.grund === IMMER).map((x) => x.id);
  if (quelle && immer.length) zeilen.push(zeile("Nicht abschaltbar", `${namen(quelle, immer)}: diese Tür liefert es immer`));
  const nachGrund = new Map<string, string[]>();
  for (const x of nichtEin.filter((y) => y.grund !== IMMER)) nachGrund.set(x.grund, [...(nachGrund.get(x.grund) ?? []), x.id]);
  for (const [g, ids] of nachGrund) if (quelle) zeilen.push(zeile("Mehr liefert diese Tür nicht", `${namen(quelle, ids)}: ${grundWort(g)}`));
  return { dazu, zeilen };
}

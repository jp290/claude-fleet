// NEUE SESSION (Entwurf Runde 4, Owner 18.10. Z132 „[Zitat entfernt]“; Auftrag der Bauleitung 19.10.: „[Zitat entfernt]“).
// Über dieses Fenster startet man zielgerichtet und einfach eine Session und versteht, was sie beim Start bekommt. Drei Spalten: links
// aufsetzen (Agent, was du machen willst, Ziel), in der Mitte die Übersicht nach den fünf Fragen mit allen Teilen, auch den ausgeschalteten,
// rechts der Text, den der Agent liest, nach denselben Fragen oder in seiner Lesereihenfolge („so liest er es“). Am Handy drei Reiter.
// Eine Änderung springt im Text an die Stelle und zeigt sie: neu leuchtet auf, weg wird durchgestrichen und klappt zu. Die Übersicht klappt
// stufenweise auf (Owner 19.10. 09:5x): erst die fünf Fragen mit Zahl und Balken, dann je Frage die Teile in drei Zuständen — drin (in
// Farbe), aus mit einem Schalter, und „[Zitat entfernt]“ eingeklappt mit Grund —, dann die Einzelheiten eines Teils. Die Ansicht
// „Aufbau“ (Lane, MAIN, Orchestratorin) bleibt das bisherige Fenster (src/k15-entwurf.ts), erreichbar über „Mit anderen Sessions arbeiten“.
import { el, api, bausteinName, OMIT_SAY, flotte, starte, zeigeSlot, meldung } from "./k15-haupt";
import { icon } from "./icons";
import { SESSION_FRAGEN, type SessionFrage } from "../session-fragen";
import { RECHTE_STANDARD, type Rechte } from "../session-rechte";
import { antwort, hole, planUrl, render, S, type St } from "./k15-zustand";
import { DAUER, HERKUNFT_WORT, ORTE, PLATZ, platzVon, sitzungModell, type Herkunft, type SitzungModell, type SitzungRolle, type Teil, type TextBlock } from "./sitzung-modell";
import { ROLLEN, spalteLinks } from "./sitzung-links";
import { agentVon, agentWort, standardAgent } from "./k15-agent";
import { modelLabel } from "./modelname";
import type { Answer } from "./founding";
import type { Antwort } from "./start-tuer";
import { aufgabeAlsText, type Aufgabe, type AufgabeFeld } from "./aufgabe";
import { attrappeFortsetzen, attrappeFuer, attrappeFuss, attrappeGestartet, attrappeModell, attrappeProfil, attrappeVorbelegen } from "./attrappe";

export interface SitzStand {
  rolle: SitzungRolle; agent: string; modell: string; effort: string; ziel: string; name: string;
  // die Aufgabe um das Ziel herum (src/aufgabe.ts): Grenze, fertig wenn, Beleg, Rückweg; leer heißt „nicht gesagt“
  aufgabe: Record<AufgabeFeld, string>;
  schalter: Record<string, "an" | "aus">; ordnung: "fragen" | "lesen"; reiter: "aufsetzen" | "uebersicht" | "text";
  dateien: Map<string, string | "laedt" | { fehler: string }>; offen: Set<string>;
  // die Übersicht: aufgeklappte Fragen, aufgeklappte „hier nicht verfügbar“, der Teil mit offenen Einzelheiten
  kapOffen: Set<SessionFrage>; nvOffen: Set<SessionFrage>; detail: string | null;
  // was er darf (session-rechte.ts) und was davon gerade offen steht: die Stufen oder alle Befehle
  rechte: Rechte; rechteWahl: "zu" | "stufe" | "ausnahme";
  // was der Text zuletzt zeigte (je Block), für die Animation; die letzte lesbare Antwort, solange die nächste lädt
  vorher: Map<string, string | null>; letzte: Answer | null; springen: boolean; busy: boolean; fehler: string | null;
}
export const sitzStand0 = (): SitzStand => ({ rolle: "einfach", agent: "", modell: "", effort: "", ziel: "", name: "", schalter: {},
  aufgabe: { grenze: "", fertig: "", beleg: "", rueckweg: "" },
  ordnung: "fragen", reiter: "aufsetzen", dateien: new Map(), offen: new Set(), kapOffen: new Set(), nvOffen: new Set(), detail: null,
  rechte: { stufe: RECHTE_STANDARD, an: [], aus: [] }, rechteWahl: "zu",
  vorher: new Map(), letzte: null, springen: false, busy: false, fehler: null });

const tk = (n: number): string => `≈ ${Math.round(n).toLocaleString("de-DE")}`;
const FARBE: Readonly<Record<Herkunft, string>> = { cc: "var(--ks-cc)", du: "var(--ks-du)", ordner: "var(--ks-ordner)", fleet: "var(--ks-fleet)" };

function dreier(z: SitzStand): { harness?: string; model?: string; effort?: string } {
  return { ...(z.agent ? { harness: z.agent } : {}), ...(z.modell ? { model: z.modell } : {}), ...(z.effort ? { effort: z.effort } : {}) };
}
// der Plan dieser Session: Rolle „Nur Ordner“ (beide Türen dieses Fensters starten ohne Rolle), dazu Agent und Schalter
function planVon(s: St): { a: Answer | null; fehler: string | null; laedt: boolean } {
  if (!s.repo) return { a: null, fehler: null, laedt: false };
  const st = hole(s, planUrl(s.repo, "nur-ordner", s.sitz.schalter, dreier(s.sitz)));
  const a = antwort(st);
  if (a) s.sitz.letzte = a;
  return { a: a ?? s.sitz.letzte, fehler: typeof st === "object" && "fehler" in st ? st.fehler : null, laedt: st === "laedt" };
}
// die Aufgabe dieses Starts; ohne Ziel keine
export const aufgabeVon = (z: SitzStand): Aufgabe | null => z.ziel.trim() ? { ziel: z.ziel, ...z.aufgabe } : null;
export function modellVon(s: St, a: Answer): SitzungModell {
  const au = aufgabeVon(s.sitz);
  const m = sitzungModell(a, { rolle: s.sitz.rolle, auftrag: au ? aufgabeAlsText(au) : "", slot: freierPlatz(s), dateien: s.sitz.dateien }, bausteinName, OMIT_SAY);
  return attrappeFuer(s) ? attrappeModell(m) : m;
}
function freierPlatz(s: St): number | null {
  const e = s.eingang && "slot" in s.eingang ? s.eingang.slot : undefined;
  if (e !== undefined && !flotte().find((x) => x.id === e)?.cwd) return e;
  return flotte().find((x) => !x.cwd)?.id ?? null;
}
// DIE FLOTTE ÄNDERT SICH (Poll des Boards, k15-lader.ts#flotteNeu): wird ein Platz frei oder belegt, gilt der Fuß neu. Ganz neu gezeichnet
// wird nur, wenn niemand in der Ansicht tippt; das Neuzeichnen verlöre das Feld mit dem Fokus
const platzGezeichnet = new WeakMap<St, number | null>();
export function sitzungFlotteNeu(s: St): void {
  if (platzGezeichnet.get(s) === freierPlatz(s)) return;
  const f = document.activeElement;
  const tippt = (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) && s.shell.detail.contains(f);
  if (tippt) fuss(s, s.sitz.letzte ? modellVon(s, s.sitz.letzte) : null);
  else render();
}

// ---------- zeichnen ----------
export function zeichneSitzung(s: St): void {
  const z = s.sitz, d = s.shell.detail;
  if (attrappeFuer(s)) attrappeVorbelegen(z);
  const { a, fehler, laedt } = planVon(s);
  const m = a ? modellVon(s, a) : null;
  if (m) for (const b of m.bloecke) if (b.laden && !z.dateien.has(b.laden)) lies(s, b.laden);
  const alt = [...d.querySelectorAll<HTMLElement>(".kscol")].map((c) => c.scrollTop);
  // DAS NEUZEICHNEN HÄLT, WO MAN TIPPT: das Feld mit Fokus (data-feld) samt Auswahl, wie in der Aufbau-Ansicht
  const f = document.activeElement;
  const fokus = (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) && d.contains(f) && f.dataset.feld
    ? { feld: f.dataset.feld, von: f.selectionStart, bis: f.selectionEnd } : null;
  const grid = el("div", "ks");
  grid.dataset.reiter = z.reiter;
  const reiter = el("div", "ksreiter");
  const seg = el("span", "kswahl");
  for (const [id, wort] of [["aufsetzen", "Aufsetzen"], ["uebersicht", "Übersicht"], ["text", "Agent.md"]] as const)
    seg.append(knopf(wort, z.reiter === id, () => { z.reiter = id; render(); }));
  reiter.append(seg);
  const links = el("aside", "kscol kslinks"), mitte = el("nav", "kscol ksindex"), rechts = el("section", "kscol kstext");
  links.append(...spalteLinks(s, Object.keys(z.schalter).length, () => fuss(s, m)));
  if (m) { mitte.append(...index(s, m)); rechts.append(...text(s, m)); }
  else {
    const satz = fehler ? `Der Plan ist nicht lesbar: ${fehler}` : s.repo ? "Der Plan wird gelesen …" : "Wähle oben, in welchem Repo die Session startet.";
    mitte.append(el("div", "ksleer", satz));
    rechts.append(el("div", "ksleer", satz));
  }
  grid.classList.toggle("laedt", laedt);
  grid.append(reiter, links, mitte, rechts);
  d.replaceChildren(grid);
  const cols = [...grid.querySelectorAll<HTMLElement>(".kscol")];
  cols.forEach((c, i) => { if (alt[i]) c.scrollTop = alt[i]; });
  const wieder = fokus ? grid.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-feld="${fokus.feld}"]`) : null;
  if (fokus && wieder) {
    wieder.focus({ preventScroll: true });
    if (fokus.von !== null && fokus.bis !== null) wieder.setSelectionRange(fokus.von, fokus.bis);
  }
  rechts.addEventListener("scroll", () => requestAnimationFrame(() => spy(grid)), { passive: true });
  fuss(s, m);
  if (m) animiere(s, grid, m);
}

function knopf(wort: string, an: boolean, tu: () => void, cls = ""): HTMLButtonElement {
  const b = el("button", cls, wort) as HTMLButtonElement;
  b.type = "button";
  b.setAttribute("aria-pressed", String(an));
  b.onclick = tu;
  return b;
}

// MITTE: die Übersicht nach den fünf Fragen, stufenweise
type Zustand = "drin" | "aus" | "nv";
const zustandVon = (t: Teil): Zustand => t.stand !== "aus" ? "drin" : t.schalter ? "aus" : "nv";
function index(s: St, m: SitzungModell): HTMLElement[] {
  const z = s.sitz;
  const kopf = el("div", "ksikopf");
  const h = el("h2", "", "Übersicht");
  h.append(el("span", "kszahl", tk(m.summe.alle)));
  // nur zum Ansehen (Gegenprobe 10:1x: als Reiter neben „Aufsetzen“ versprach die Übersicht Einstellungen)
  kopf.append(h, el("p", "", "Nur zum Ansehen: was er beim Start bekommt, nach fünf Fragen."));
  const out: HTMLElement[] = [kopf];
  SESSION_FRAGEN.forEach((f, i) => {
    const teile = m.teile.filter((x) => x.frage === f.id);
    const drin = teile.filter((t) => zustandVon(t) === "drin"), nv = teile.filter((t) => zustandVon(t) === "nv");
    const auf = z.kapOffen.has(f.id);
    const kap = el("div", `kskap${auf ? " auf" : ""}`);
    kap.dataset.kap = f.id;
    const k = el("button", "kskapk") as HTMLButtonElement;
    k.type = "button";
    k.setAttribute("aria-expanded", String(auf));
    k.title = f.frage;
    k.append(el("span", "ksnr", String(i + 1)), el("b", "", f.wort), el("span", "kstk", m.summe.je[f.id] ? tk(m.summe.je[f.id]) : "—"),
      el("span", "ksfr", f.frage), el("span", "ksanz", drin.length ? `${drin.length} im Start` : "nichts im Start"), icon("chevron"));
    const bal = el("span", "ksbalken");
    for (const her of ["cc", "du", "ordner", "fleet"] as const) {
      const v = m.summe.herkunft[f.id][her];
      if (!v || !m.summe.alle) continue;
      const seg = el("i", "");
      seg.style.width = `${(v / m.summe.alle) * 100}%`;
      seg.style.background = FARBE[her];
      bal.append(seg);
    }
    k.append(bal);
    // am Handy bleibt man in der Übersicht; am Desktop geht der Text mit
    k.onclick = () => { if (auf) z.kapOffen.delete(f.id); else z.kapOffen.add(f.id); render(); if (!auf && !schmal()) zeigeImText(s, `[data-kapitel-t="${f.id}"]`); };
    const ul = el("ul", "ksteile");
    for (const t of teile.filter((x) => zustandVon(x) !== "nv")) ul.append(...teilZeile(s, t, f.id));
    if (nv.length) {
      const offen = z.nvOffen.has(f.id);
      const nk = el("button", "ksnvk") as HTMLButtonElement;
      nk.type = "button";
      nk.setAttribute("aria-expanded", String(offen));
      nk.append(el("span", "", `${nv.length} ${nv.length === 1 ? "weiterer" : "weitere"} hier nicht verfügbar`), icon("chevron"));
      nk.title = "Teile, die andere Starts bekommen, dieser hier nicht; aufgeklappt mit Grund";
      nk.onclick = () => { if (offen) z.nvOffen.delete(f.id); else z.nvOffen.add(f.id); render(); };
      const nl = el("ul", `ksnv${offen ? " auf" : ""}`);
      for (const t of nv) nl.append(...teilZeile(s, t, f.id));
      const nz = el("li", "ksnvz");
      nz.append(nk);
      ul.append(nz, nl);
    }
    kap.append(k, ul);
    out.push(kap);
  });
  const leg = el("div", "kslegende");
  for (const her of ["cc", "du", "ordner", "fleet"] as const) {
    const x = el("span", "");
    const i = el("i", "");
    i.style.background = FARBE[her];
    x.append(i, HERKUNFT_WORT[her]);
    leg.append(x);
  }
  out.push(leg);
  return out;
}
// EIN TEIL: drin in Farbe, aus mit Schalter, nicht verfügbar grau mit Grund; ein Klick zeigt ihn im Text und seine Einzelheiten
function teilZeile(s: St, t: Teil, frage: SessionFrage): HTMLElement[] {
  const zu = zustandVon(t);
  const li = el("li", `ksteil h-${t.herkunft} ${zu}`);
  li.dataset.teil = t.id;
  li.title = [t.fach, zu === "nv" ? t.fest : null].filter(Boolean).join(" · ");
  const n = el("span", "ksn", t.name);
  if (t.zusatz) n.append(el("small", "", t.zusatz));
  if (t.unter) n.append(el("span", "ksnu", t.unter));
  li.append(el("span", "ksd"), n, el("span", "kstk", t.tokens ? `${t.unbekannt ? "≥" : ""}${Math.round(t.tokens).toLocaleString("de-DE")}` : ""));
  if (t.schalter) {
    const sw = el("button", "kssw") as HTMLButtonElement;
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(t.schalter.an));
    sw.setAttribute("aria-label", t.name);
    const id = t.schalter.baustein, an = t.schalter.an;
    sw.onclick = (e) => { e.stopPropagation(); s.sitz.schalter = { ...s.sitz.schalter, [id]: an ? "aus" : "an" }; s.sitz.springen = true; render(); };
    li.append(sw);
  }
  li.onclick = () => {
    s.sitz.detail = s.sitz.detail === t.id ? null : t.id;
    render();
    if (zu !== "nv" && !schmal()) imText();
  };
  const imText = () => zeigeImText(s, `[data-teil-b="${CSS.escape(t.id)}"]:not(.zu)`, `[data-kapitel-t="${frage}"]`);
  if (s.sitz.detail !== t.id) return [li];
  li.classList.add("offen");
  const d = el("li", "ksdetail");
  const zeilen: [string, string][] = [...t.mehr, ["Woher", HERKUNFT_WORT[t.herkunft]]];
  if (t.fach) zeilen.push(["Fachwort", t.fach]);
  if (zu === "nv" && t.fest) zeilen.push(["Warum nicht", t.fest]);
  else if (t.fest) zeilen.push(["Abschalten", t.fest]);
  for (const [k, v] of zeilen) { const r = el("div", ""); r.append(el("span", "", k), el("span", "", v)); d.append(r); }
  if (zu !== "nv") {
    // die beiden Knöpfe in einer Zeile für sich, durch eine Linie abgesetzt — nicht unter der letzten Beschriftung, wo sie wie ein Fachwort ohne Wert standen
    const tun = el("div", "kstun");
    const zeig = el("button", "ksdetailk", "im Text zeigen") as HTMLButtonElement;
    zeig.type = "button";
    zeig.onclick = imText;
    const um = el("button", "ksprobek klein") as HTMLButtonElement;
    um.type = "button";
    um.disabled = true;
    um.title = "Den Text dieses Teils für diesen Start ersetzen. Kommt bald.";
    um.append(icon("pencil"), el("span", "", "umschreiben"), el("small", "", "bald"));
    tun.append(zeig, um);
    d.append(tun);
  }
  return [li, d];
}

// RECHTS: DEINE AGENT.MD (Owner 19.10. 10:1x: „[Zitat entfernt]“). Je Frage zuerst, was in der Datei steht,
// dann, was Claude Code und Fleet außerdem mitgeben; jeder Block sagt, wo er landet und ob er bleibt
function text(s: St, m: SitzungModell): HTMLElement[] {
  const z = s.sitz;
  const kopf = el("div", "kstkopf");
  const h = el("h2", "");
  h.append(icon("file"), "Deine Agent.md");
  // die Datei und was außerdem kommt, getrennt gezählt (Gegenprobe 10:4x: die Kopfzahl war die des ganzen Starts)
  const inDatei = m.bloecke.filter((b) => platzVon(b) === "agentmd").reduce((n, b) => n + b.tokens, 0);
  const zahl = el("span", "kszahl", `${tk(inDatei)} Tokens`);
  kopf.append(h, zahl, el("span", "ksausz", `außerdem ${tk(m.summe.alle - inDatei)}`));
  const seg = el("span", "kswahl");
  // eine andere Ordnung ist ein anderes Dokument: es beginnt oben
  const ordne = (o: SitzStand["ordnung"]) => () => { if (z.ordnung === o) return; z.ordnung = o; render(); s.shell.detail.querySelector(".kstext")?.scrollTo({ top: 0 }); };
  seg.append(knopf("nach den fünf Fragen", z.ordnung === "fragen", ordne("fragen")), knopf("so liest er es", z.ordnung === "lesen", ordne("lesen")));
  seg.title = "Dieselben Teile: geordnet nach den fünf Fragen oder in der Reihenfolge, in der er sie beim Start liest";
  kopf.append(seg);
  const dok = el("div", "ksdok");
  dok.append(el("p", "kszweck", "Was er beim Start liest. In der Datei steht, was von dir, aus dem Ordner und von Fleet kommt; darunter, was Claude Code und Fleet außerdem mitgeben."));
  const ablage = el("div", "ksablage");
  ablage.title = "Eine vorhandene Agent.md wird der Grundstock; Fleets Teile setzen sich darauf. Bei einem Ordner gelten seine AGENTS.md und CLAUDE.md.";
  ablage.append(icon("file"), el("span", "", "Eigene Agent.md oder einen Ordner hierher ziehen"), el("small", "", "bald"));
  dok.append(ablage);
  const sichtbar = (b: TextBlock): boolean => b.text !== null || !!b.laden;
  if (z.ordnung === "fragen") SESSION_FRAGEN.forEach((f, i) => {
    const k = el("div", "kskapitel");
    k.dataset.kapitelT = f.id;
    k.append(el("span", "ksnr", String(i + 1)), el("h3", "", f.wort), el("span", "", f.frage));
    dok.append(k);
    const bs = m.bloecke.filter((b) => b.frage === f.id);
    const datei = bs.filter((b) => platzVon(b) === "agentmd"), sonst = bs.filter((b) => platzVon(b) !== "agentmd");
    if (!bs.some(sichtbar)) dok.append(el("div", "ksleerh", "Nichts davon in diesem Start."));
    for (const b of datei) dok.append(blockEl(s, b, null));
    if (sonst.some(sichtbar)) dok.append(el("div", "ksaussen", "außerdem, nicht in der Datei"));
    for (const b of sonst) dok.append(blockEl(s, b, null));
  });
  else for (const o of ORTE) {
    const k = el("div", "kskapitel ort");
    k.append(el("h3", "", o.wort), el("span", "", o.satz));
    dok.append(k);
    for (const b of m.bloecke.filter((x) => x.ort === o.id)) dok.append(blockEl(s, b, SESSION_FRAGEN.find((f) => f.id === b.frage)?.wort ?? ""));
  }
  return [kopf, dok];
}
// ein Block: woher, wo er landet, ob er bleibt; `frage` nennt in der Lesereihenfolge die Frage, zu der er gehört
function blockEl(s: St, b: TextBlock, frage: string | null): HTMLElement {
  const z = s.sitz;
  const datei = b.laden ? z.dateien.get(b.laden) : undefined;
  const t = b.text ?? (datei === "laedt" ? "wird gelesen …" : datei && typeof datei === "object" ? `nicht lesbar: ${datei.fehler}` : null);
  const platz = platzVon(b), dauer = PLATZ[platz].dauer;
  const box = el("div", `ksblk h-${b.herkunft}${platz === "agentmd" ? " p-datei" : ""}${b.leise ? " leise" : ""}${t === null ? " zu" : ""}`);
  box.dataset.b = b.id;
  box.dataset.teilB = b.teil;
  box.dataset.platz = platz;
  const inner = el("div", "ksin"), rahmen = el("div", "ksrahmen"), meta = el("div", "ksmeta");
  if (b.titel) meta.append(el("span", "kst", b.titel));
  const wo = el("span", "ksplatz", PLATZ[platz].wort);
  const wie = el("span", `ksdauer ${dauer}`, DAUER[dauer].wort);
  wie.title = DAUER[dauer].satz;
  meta.append(el("span", "", frage ? `${HERKUNFT_WORT[b.herkunft]} · ${frage}` : HERKUNFT_WORT[b.herkunft]), wo, wie,
    el("span", "kstk", b.tokens ? `${tk(b.tokens)} Tokens` : ""));
  const zeilen = (t ?? "").split("\n");
  const falte = !z.offen.has(b.id) && zeilen.length > b.falte + 2;
  const pre = el("pre", "", falte ? zeilen.slice(0, b.falte).join("\n") : t ?? "");
  rahmen.append(meta, pre);
  if (falte) {
    const mehr = el("button", "ksmehr", `… ${zeilen.length - b.falte} Zeilen mehr`) as HTMLButtonElement;
    mehr.type = "button";
    mehr.onclick = () => { z.offen.add(b.id); render(); };
    rahmen.append(mehr);
  }
  inner.append(rahmen);
  box.append(inner);
  return box;
}

// DIE ÄNDERUNG ZEIGEN: was neu im Text steht, leuchtet auf; was wegfällt, wird durchgestrichen und klappt zu. Hat eine Eingabe sie
// ausgelöst, springt der Text an die erste Stelle (am Handy nur, wenn der Reiter „Text“ offen ist)
function animiere(s: St, grid: HTMLElement, m: SitzungModell): void {
  const z = s.sitz;
  const erst = z.vorher.size === 0;
  const geaendert: HTMLElement[] = [];
  for (const b of m.bloecke) {
    const box = grid.querySelector<HTMLElement>(`.ksblk[data-b="${CSS.escape(b.id)}"]`);
    const jetzt = b.text ?? (b.laden ? "" : null), vor = z.vorher.get(b.id);
    z.vorher.set(b.id, jetzt);
    if (erst || vor === undefined || !box || (vor === null) === (jetzt === null)) continue;
    if (vor === null) { box.classList.add("blitz-an"); geaendert.push(box); continue; }
    box.classList.remove("zu");
    box.classList.add("blitz-weg");
    const pre = box.querySelector("pre");
    if (pre) pre.textContent = vor.split("\n").slice(0, b.falte).join("\n");
    setTimeout(() => { box.classList.add("zu"); box.classList.remove("blitz-weg"); }, 650);
    geaendert.push(box);
  }
  if (!z.springen) return;
  z.springen = false;
  if (geaendert.length && (!schmal() || z.reiter === "text")) springe(grid, geaendert[0]);
}
const schmal = (): boolean => matchMedia("(max-width: 760px)").matches;
function springe(grid: HTMLElement, ziel: HTMLElement): void {
  const sp = grid.querySelector<HTMLElement>(".kstext");
  if (!sp) return;
  let vor = ziel.previousElementSibling;
  while (vor?.classList.contains("zu") || vor?.classList.contains("ksleerh")) vor = vor.previousElementSibling;
  const an = vor?.classList.contains("kskapitel") ? vor as HTMLElement : ziel;
  const kopf = sp.querySelector<HTMLElement>(".kstkopf")?.offsetHeight ?? 0;
  sp.scrollTo({ top: Math.max(0, an.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - kopf - 16), behavior: "smooth" });
}
function zeigeImText(s: St, ...wahl: string[]): void {
  if (schmal()) { s.sitz.reiter = "text"; render(); }
  const grid = s.shell.detail.querySelector<HTMLElement>(".ks");
  const ziel = wahl.map((w) => grid?.querySelector<HTMLElement>(w)).find(Boolean);
  if (!grid || !ziel) return;
  springe(grid, ziel);
  ziel.classList.remove("puls");
  void ziel.offsetWidth;
  ziel.classList.add("puls");
}
// BEIM LESEN zeigt die Übersicht, wo man ist
function spy(grid: HTMLElement): void {
  const sp = grid.querySelector<HTMLElement>(".kstext");
  if (!sp) return;
  const grenze = sp.getBoundingClientRect().top + (sp.querySelector<HTMLElement>(".kstkopf")?.offsetHeight ?? 0) + 8;
  const da = [...sp.querySelectorAll<HTMLElement>(".ksblk:not(.zu)")].find((x) => x.getBoundingClientRect().bottom > grenze);
  for (const x of grid.querySelectorAll(".ksteil.hier, .kskap.hier")) x.classList.remove("hier");
  if (!da) return;
  const teil = grid.querySelector<HTMLElement>(`.ksteil[data-teil="${CSS.escape(da.dataset.teilB ?? "")}"]`);
  teil?.classList.add("hier");
  teil?.closest(".kskap")?.classList.add("hier");
}

function lies(s: St, pfad: string): void {
  const z = s.sitz;
  z.dateien.set(pfad, "laedt");
  void api(`/api/file?path=${encodeURIComponent(pfad)}`).then(async (r) => {
    const j: unknown = await r.json().catch(() => null);
    const t = j && typeof j === "object" && "text" in j && typeof j.text === "string" ? j.text : null;
    z.dateien.set(pfad, t !== null ? t : { fehler: j && typeof j === "object" && "error" in j ? String(j.error) : `Antwort ${r.status}` });
  }).catch((e: unknown) => { z.dateien.set(pfad, { fehler: e instanceof Error ? e.message : "Server nicht erreichbar" }); })
    .finally(() => { if (S === s) render(); });
}

// ---------- unten: Summe und Start ----------
function blocker(s: St, a: Answer | null): string | null {
  const z = s.sitz;
  if (!s.repo) return "Wähle oben, in welchem Repo die Session startet.";
  if (!a) {
    const { fehler } = planVon(s);
    return fehler ? `Der Plan für diesen Start ist nicht lesbar: ${fehler}` : "Der Plan für diesen Start wird gelesen …";
  }
  const ka = s.katalog, id = z.agent || (ka ? standardAgent(ka) : null);
  const aus = ka && id ? agentVon(ka, id)?.aus : null;
  if (aus) return `${agentWort(id ?? "")} startet hier nicht: ${aus.grund}.`;
  if (z.rolle === "branch" && !z.name.trim()) return "Gib dem Branch einen Namen für das Board.";
  if (z.rolle === "einfach" && freierPlatz(s) === null) return "Kein freier Platz in der Leiste.";
  return null;
}
function fuss(s: St, m: SitzungModell | null): void {
  const f = s.shell.foot, z = s.sitz;
  platzGezeichnet.set(s, freierPlatz(s));
  const a = z.letzte;
  f.replaceChildren();
  f.classList.remove("k15foot");
  f.classList.add("ksfuss");
  const links = el("div", "kssatzc");
  const ag = z.agent || (s.katalog ? standardAgent(s.katalog) ?? "claude" : "claude");
  const say = el("span", "kssay");
  say.append(el("b", "", agentWort(ag)), ` · ${z.modell ? modelLabel(z.modell) : "Standard-Modell"} · ${ROLLEN.find((r) => r.id === z.rolle)?.wort ?? ""}`);
  const nein = z.fehler ?? blocker(s, a);
  const fort = attrappeFuer(s) ? attrappeFortsetzen(s) : null;
  links.append(say, el("span", `kssatz${z.fehler ? " warn" : ""}`, nein ?? (fort
    ? `Setzt ${fort} mit seinem letzten Gespräch fort${z.ziel.trim() ? "; das Ziel geht als nächste Nachricht an die Session" : ""}.`
    : z.rolle === "branch" ? "Der Branch entsteht in diesem Repo; das Ziel geht als erste Nachricht an die Session." : `Startet auf Slot ${freierPlatz(s) ?? "—"}.`)));
  const rechts = el("div", "ksfussr");
  const summe = el("div", "kssumme");
  summe.append(el("span", "", m ? `Start ${tk(m.summe.alle)} Tokens` : "Start …"), el("small", "", m ? `davon Fleet ${m.summe.fleet ? tk(m.summe.fleet) : "nichts"}` : ""));
  const go = el("button", "ksgo", z.busy ? "Startet …" : "Session starten") as HTMLButtonElement;
  go.type = "button";
  go.disabled = z.busy || (nein !== null && !z.fehler);
  go.onclick = () => { void los(s); };
  rechts.append(summe, go);
  if (attrappeFuer(s)) rechts.prepend(attrappeFuss(s));
  f.append(links, rechts);
}
async function los(s: St): Promise<void> {
  const z = s.sitz, a = z.letzte;
  if (z.busy || blocker(s, a) !== null || !a || !s.repo) return;
  z.busy = true;
  z.fehler = null;
  render();
  const d = dreier(z);
  const sw = Object.entries(z.schalter).map(([id, v]) => `${id}=${v}`).sort().join(",");
  const slot = freierPlatz(s);
  // was er darf, geht mit, wenn er Claude Code ist: es sind dessen Regeln (server/rechte.ts)
  const ag = z.agent || (s.katalog ? standardAgent(s.katalog) ?? "claude" : "claude");
  const rechte = ag === "claude" ? { rechte: z.rechte } : {};
  const profil = attrappeFuer(s) ? attrappeProfil(s) : {};
  const fort = attrappeFuer(s) ? attrappeFortsetzen(s) : null;
  const aufgabe = aufgabeVon(z);
  const r: Antwort = z.rolle === "branch"
    ? await starte({ tuer: "branch", repo: s.repo, name: z.name.trim(), ziel: z.ziel.trim(), punkte: [], dreier: d, ...rechte, ...profil, ...(fort ? { bestehend: fort } : {}),
      ...(aufgabe ? { aufgabe } : {}), ...(z.schalter.bibliothek ? { bibliothek: z.schalter.bibliothek === "an" } : {}) })
    : slot === null ? { ok: false, fehler: "Kein freier Platz in der Leiste." }
    : await starte({ tuer: "open", cwd: s.repo, slot, dreier: d, ...rechte, ...profil,
      plan: a.start.startbar ? { hash: a.plan.planHash, role: "nur-ordner", ...(sw ? { bausteine: sw } : {}) } : null,
      // ohne Plan geht der Schalter „Fleets Bibliothek“ als eigenes Feld mit (server.ts#bibliothekDerTuer)
      ...(!a.start.startbar && z.schalter.bibliothek ? { bibliothek: z.schalter.bibliothek === "an" } : {}) });
  if (S !== s) return;
  z.busy = false;
  if (r.ok) {
    if (attrappeFuer(s)) { attrappeGestartet(s, r.slot); return; }
    s.shell.close();
    zeigeSlot(r.slot);
    if (r.hinweis) meldung(`Die Session steht auf Slot ${r.slot}. ${r.hinweis}`);
    return;
  }
  z.fehler = r.fehler;
  if (r.bewegt) s.plaene.clear();
  render();
}

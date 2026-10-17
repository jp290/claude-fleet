// K15 ENTWURF D · SPALTE 3, was die angeklickte Session (oder jede Session eines Profils) bekommt: die Bausteine ihres Gründungsplans
// in Gruppen, ihre Einstellungen mit Herkunft, ihre Rechte und ihre Verbindungen im Lauf. Tokens und Größen stehen erst beim
// Darüberfahren oder mit „Alles zeigen“ da (Owner 16.10.); fehlt ein Thema, legt man hier einen Kontextpack an.
import { el, baseName, PACK_WORDS, bausteinName } from "./k15-haupt";
import { icon } from "./icons";
import { modelLabel } from "./modelname";
import type { Answer, Baustein } from "./founding";
import {
  EFFORT_WORT, EINSTELLUNGEN_ID, GRUPPEN, STUFEN, abwZahl, alle, aspekt, eltern, gruppeVon, pct, schalte, schwelleVon, stufeAus, stufeWort,
  tokVon, traegerVon, umfangId, umfangVon, verbindungen, type Feld, type GruppeId, type Position, type Profil, type Stufe,
} from "./k15-entwurf-modell";
import {
  S, antwort, bausteineVon, dreier, eigeneBytes, fehltWeil, gehe, gewaehlt, kommtAn, lage, lies, planUrl, plural, render, schwelleWahl, toast, wahlVon, wegVon, werPlan, zeige,
  type Detail, type Lage, type QuelleId, type St,
} from "./k15-zustand";
import { chip, istSchalter, kennzeichen, kopfzeile, nachZahl, schalt, waehle, type Option } from "./k15-teile";
import { agentOptionen, agentWort, effortVon, modelleVon, passtEffort, passtModell } from "./k15-agent";
import { werBestimmt } from "./k15-wer";
import { autonomieBlock } from "./k15-autonomie";
import { entferne } from "./k15-spalte2";
import { eigeneVon } from "./k15-wortlaut-ui";
import { istPackRolle, packBytes, packLandung, neuerPack, type PackEntwurf } from "./k15-kontextpack";
import { oeffneAblauf } from "./k15-agentmd";
import { anatomieVon, quelleSatz, tokCc, zaehlung } from "./k15-anatomie-ui";
import { gruppenBytes, zaehltMit } from "./k15-anatomie";

const DETAILS: readonly { id: Detail; wort: string }[] = [{ id: "gruppen", wort: "Gruppen" }, { id: "bausteine", wort: "Bausteine" }];
const DETAIL_KEY = "fleet.k15.detail";
const SCHWELLEN = [30, 35, 37, 40, 45, 50, 0];

export function gemerktesDetail(): Detail {
  try { return localStorage.getItem(DETAIL_KEY) === "gruppen" ? "gruppen" : "bausteine"; } catch { return "bausteine"; }
}
// ein neuer Detailgrad gilt für alle Gruppen; was man einzeln auf- oder zugeklappt hatte, fällt weg
function setzeDetail(s: St, d: Detail): void {
  s.detail = d;
  for (const k of [...s.offen]) if (k.startsWith("g+:") || k.startsWith("g-:")) s.offen.delete(k);
  try { localStorage.setItem(DETAIL_KEY, d); } catch { /* ohne Speicher gilt die Wahl bis zum Schließen */ }
  render();
}
// Spalte 4 zeigt einen Baustein genau: was er tut, was ohne ihn fehlt, wie er ankommt; ein Pack steht aufgeklappt in seiner Ansicht
export function springe(id: string): void {
  const s = S;
  if (!s) return;
  if (id.startsWith("pack:")) { s.quelle = "packs"; s.offen.add(`pk:${id.slice(5)}`); gehe(3, 3); return; }
  s.quelle = "bst";
  s.bst = id;
  gehe(3, 3);
}
// einen Kontextpack anlegen oder einen Entwurf öffnen: der Editor steht in Spalte 4
export function oeffnePack(s: St, pk: PackEntwurf | null): void {
  const { p } = gewaehlt(s);
  s.packEdit = pk ? structuredClone(pk) : neuerPack(p.rolle, "du", Date.now());
  s.quelle = "packs";
  gehe(3, 3);
}

// ein Feld setzen: für die Position als Abweichung, sonst im Profil; gleich dem Wert darunter heißt: keine Abweichung
function setze(s: St, q: Position | null, p: Profil, feld: Feld, neu: string | number): void {
  if (q) {
    const darunter = feld === "schwelle" ? (p.schwelle ?? schwelleVon(p.schiene, s.env ?? null).pct) : (p[feld] ?? wahlVon(s, p, null, feld).wert);
    const abw = { ...q.abw };
    if (feld === "schwelle") abw.schwelle = Number(neu); else abw[feld] = String(neu);
    if (neu === darunter) delete abw[feld];
    if (Object.keys(abw).length) q.abw = abw; else delete q.abw;
    s.konstNeu.add(s.k.id);
  } else {
    if (feld === "schwelle") p.schwelle = typeof neu === "number" ? neu : Number(neu);
    else p[feld] = String(neu);
    s.profilNeu.add(p.id);
  }
  if (feld === "agent") passeAn(s, q, p);
  s.quelle = "einst";
  render();
}
// ein neuer Agent nimmt nicht mit, was zum alten gehört (wie src/founding.ts#pickHarness): ein Modell oder Effort, den er nicht kennt,
// fällt auf dieser Ebene weg, und es gilt seiner
function passeAn(s: St, q: Position | null, p: Profil): void {
  const agent = wahlVon(s, p, q, "agent").wert, kat = s.katalog ?? null;
  if (q) {
    const abw = { ...q.abw };
    if (typeof abw.modell === "string" && !passtModell(kat, agent, abw.modell)) delete abw.modell;
    if (typeof abw.effort === "string" && !passtEffort(kat, agent, abw.effort)) delete abw.effort;
    if (Object.keys(abw).length) q.abw = abw; else delete q.abw;
    return;
  }
  if (p.modell !== null && !passtModell(kat, agent, p.modell)) p.modell = null;
  if (p.effort !== null && !passtEffort(kat, agent, p.effort)) p.effort = null;
}
// den Umfang einer Gruppe setzen: für die Position als Abweichung, sonst im Profil; einzelne Schalter der Gruppe fallen weg, die der
// anderen Gruppen bleiben
function setzeUmfang(s: St, q: Position | null, p: Profil, g: GruppeId, neu: Stufe, ids: string[]): void {
  const id = umfangId(g);
  const ohne = (x: Record<string, "an" | "aus"> | undefined) => Object.fromEntries(Object.entries(x ?? {}).filter(([k]) => !ids.includes(k)));
  if (q) {
    const w = { ...q.werteAbw, [id]: neu };
    if (neu === (p.werte[id] ?? aspekt(id)?.standard)) delete w[id];
    if (Object.keys(w).length) q.werteAbw = w; else delete q.werteAbw;
    const rest = ohne(q.schalter);
    if (Object.keys(rest).length) q.schalter = rest; else delete q.schalter;
    s.konstNeu.add(s.k.id);
  } else {
    p.werte = { ...p.werte, [id]: neu };
    p.schalter = ohne(p.schalter);
    s.profilNeu.add(p.id);
  }
  render();
}
// einen Baustein schalten: der Server prüft die neuen Schalter wie bei einem Start; lehnt er ab, bleibt alles, wie es war. Gerechnet
// wird aus dem Zustand nach der Prüfung, nicht aus dem beim Klick: Hat ein zweiter Klick die Schalter derweil geändert, prüft der Server
// die Summe beider noch einmal, so geht keiner verloren (Prüfung Punkt 10). Ein Fehler wird nicht gemerkt.
const RUNDEN = 4;
export async function setzeBaustein(s: St, q: Position | null, p: Profil, b: Baustein, an: boolean): Promise<void> {
  const ziel = (): { neu: ReturnType<typeof schalte>; url: string } | null => {
    const l = lage(s, p, q);
    if (!l || !s.repo) return null;
    const std = antwort(l.voll)?.plan.bausteine.find((x) => x.id === b.id)?.zustand === "an" ? "an" : "aus";
    const neu = schalte(l.unten, l.eigen, b.id, an, std);
    return { neu, url: planUrl(s.repo, p.rolle, { ...l.unten, ...neu }, dreier(s, p, q)) };
  };
  for (let runde = 0; runde < RUNDEN; runde++) {
    const z = ziel();
    if (!z) return;
    const da = s.plaene.get(z.url);
    const st = da && da !== "laedt" && !("fehler" in da) ? da : await lies(z.url);
    if (S !== s) return;
    if ("fehler" in st) { toast(`${bausteinName(b)}: ${st.fehler}`); return; }
    s.plaene.set(z.url, st);
    if (ziel()?.url !== z.url) continue;
    if (q) { if (Object.keys(z.neu).length) q.schalter = z.neu; else delete q.schalter; s.konstNeu.add(s.k.id); }
    else { p.schalter = z.neu; s.profilNeu.add(p.id); }
    if (b.id.startsWith("pack:")) s.quelle = "packs"; else { s.quelle = "bst"; s.bst = b.id; }
    render();
    return;
  }
  toast(`${bausteinName(b)}: Die Schalter haben sich während der Prüfung mehrmals geändert. Schalte noch einmal.`);
}

export function spalteSession(): HTMLElement {
  const s = S;
  const col = el("section", "k15col k15c3");
  if (!s) return col;
  const { q, p } = gewaehlt(s);
  col.append(kopfzeile(2, q ? "was diese Session bekommt" : "gilt für jede Session mit dieser Rolle"));
  const head = el("div", "k15sh");
  const g = el("span", "fdglyph");
  g.append(icon(p.glyph));
  const t = el("span", "k15kt");
  const vater = q ? eltern(s.k, q.id) : null;
  const n = alle(s.k.wurzeln).filter((x) => x.profil === p.id).length;
  t.append(el("span", "k15shn", q ? q.name : `Profil ${p.name}`),
    el("span", "k15ks", q ? `Profil ${p.name} v${p.v}${vater ? ` · meldet an ${vater.name}` : ""}`
      : `${n ? `${plural(n, "Session", "Sessions")} im Aufbau` : "im Aufbau nicht genutzt"} · ältere Versionen: ${p.v > 1 ? Array.from({ length: p.v - 1 }, (_, i) => `v${p.v - 1 - i}`).join(", ") : "keine"}`));
  head.append(g, t);
  if (!q) head.append(chip(s.profilNeu.has(p.id) ? `v${p.v} ●` : p.v, `Version ${p.v} des Profils ${p.name}`));
  col.append(head);
  // bei einer Session mit eigener Agent-MD ist die Datei das Erste, was sie bekommt: direkt unter dem Kopf, vor der Autonomie
  if (p.id === "eigen" || p.glyph === "file") {
    const cta = el("button", "k15mdcta");
    const t = el("span", "k15kt");
    t.append(el("span", "k15mdctaw", q?.datei ? `${q.datei.titel} bearbeiten` : "Deine Agent-MD einrichten"),
      el("span", "k15mdctas", "Datei · Abschnitte · was Fleet dazugibt · als Profil speichern"));
    cta.append(icon("file"), t, icon("chevron"));
    cta.onclick = () => oeffneAblauf(s);
    col.append(cta);
  }
  col.append(...autonomieBlock(s, p, q));

  const gruppe = (titel: string, v: number | null, quelle: QuelleId | null, zeilen: HTMLElement[]) => {
    const h = el("div", "k15sec");
    h.append(el("span", "k15secw", titel));
    if (v !== null) h.append(chip(v, `Version ${v} dieses Bausteins`));
    if (quelle) {
      const l = el("button", `k15glink${s.quelle === quelle ? " on" : ""}`);
      l.append(el("span", "", "Quelle"), icon("chevron"));
      l.onclick = () => { s.quelle = quelle; gehe(3, 3); };
      h.append(l);
    }
    const box = el("div", "k15grp");
    box.append(...zeilen);
    col.append(h, box);
  };
  // eine Zeile: Wert und Daten sichtbar; Erklärung und „Standard → hier“ erst bei Hover, Fokus oder Antippen (Owner 11:0x). `innen`
  // nennt Datei und Funktion, aus der die Erklärung stammt; sie steht nur im Title.
  const zeile = (o: { k: string; v: string; sub?: string; erkl?: string[]; innen?: string; quelle?: QuelleId;
    wahl?: { optionen: Option[]; jetzt: string; nimmt: (v: string) => void }; abw?: string }): HTMLElement => {
    const key = `x:z:${o.k}`;
    const r = el("div", `k15z${o.quelle ? " geht" : ""}${o.quelle && s.quelle === o.quelle ? " on" : ""}${o.abw ? " abw" : ""}${s.offen.has(key) ? " zeig" : ""}`);
    const vv = el("span", "k15zv");
    const wahl = o.wahl;
    if (wahl) {
      const sw = el("button", "k15sw");
      sw.append(el("span", "", o.v), icon("chevron"));
      sw.onclick = () => waehle(sw, wahl.optionen, wahl.jetzt, wahl.nimmt);
      vv.append(sw);
    } else vv.append(el("span", "k15zt", o.v));
    if (o.abw) vv.firstChild?.after(el("span", "k15mark"));
    if (o.sub) vv.append(el("span", "k15zsub", o.sub));
    const erkl = [...(o.abw ? [`Standard (${p.name} v${p.v}): ${o.abw} → hier: ${o.v}`] : []), ...(o.erkl ?? [])].filter(Boolean);
    if (erkl.length) {
      const x = el("span", "k15x");
      x.append(...erkl.map((z) => el("span", "", z)));
      if (o.innen) x.title = o.innen;
      vv.append(x);
      if (!o.quelle) r.onclick = (e) => { if (!(e.target instanceof Element && e.target.closest("button"))) zeige(key); };
    }
    r.append(el("span", "k15zk", o.k), vv);
    if (o.quelle) {
      const ziel = o.quelle;
      r.tabIndex = 0;
      r.setAttribute("role", "button");
      r.append(icon("chevron"));
      r.onclick = () => { s.quelle = ziel; gehe(3, 3); };
      r.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.quelle = ziel; gehe(3, 3); } };
    }
    return r;
  };

  const l = lage(s, p, q);
  const a = l ? antwort(l.plan) : null;
  const voll = l ? antwort(l.voll) : null;
  // ein Baustein mit einer eigenen Fassung eines seiner Abschnitte trägt dasselbe Kennzeichen wie ein eigenes Profil
  const eigeneV = a ? eigeneVon(s, p, q, a) : new Map<string, number>();
  const traeger = a ? traegerVon(a.plan.bausteine) : new Map<string, Baustein>();
  const wp = a ? werPlan(s, a) : null;
  // EIN BAUSTEIN des Plans: Name, wo er landet, Schalter; seine Größe, was er tut, was ohne ihn bricht und warum er Pflicht ist erst bei
  // Info, Hover, Fokus oder mit „Alles zeigen“. An im Plan, aber diese Tür liefert es nicht: blass, ohne Schalter, mit dem Grund.
  const bausteinZeile = (b: Baustein, lg: Lage, an0: Answer): HTMLElement => {
    const key = `x:b:${b.id}`;
    const an = b.zustand === "an";
    const fehlt = fehltWeil(an0, b);
    const pflicht = b.grenze.art === "noetig" && an;
    const traegt = an ? traeger.get(b.id) : undefined;
    // einen Schalter gibt es genau dann, wenn rechts „änderbar“ steht (src/k15-wer.ts); dazu zählt auch eine unerfüllte Bedingung und ein
    // Pack ohne Quelle als fest: beides lehnt der Plan ab
    const wer = wp ? werBestimmt(b, wp) : null;
    const frei = wer?.art === "du";
    const eigen = lg.eigen[b.id] !== undefined;
    const std = voll?.plan.bausteine.find((x) => x.id === b.id)?.zustand ?? "aus";
    const r = el("div", `k15tz${an && fehlt === null ? "" : " aus"}${fehlt === null ? "" : " fehlt"}${s.offen.has(key) ? " zeig" : ""}${s.quelle === "bst" && s.bst === b.id ? " on" : ""}`);
    r.dataset.id = b.id;
    const tt = el("span", "k15kt");
    const kopf = el("span", "k15tzk");
    kopf.append(el("span", "k15tzn", bausteinName(b)));
    if (pflicht) kopf.append(el("span", "k15ver", b.grenze.art === "noetig" && b.grenze.gesperrt ? "gesperrt" : "Pflicht"));
    else if (traegt) kopf.append(el("span", "k15ver", `trägt ${bausteinName(traegt)}`));
    if (eigen) kopf.append(el("span", "k15mark"));
    const ev = eigeneV.get(b.id);
    if (ev) kopf.append(...kennzeichen({ art: "eigen" }, ev));
    const weg = wegVon(an0, b);
    const groesse = an && typeof b.bytes === "number" ? tokVon(b.bytes) : "";
    const unter = el("span", "k15tzp");
    if (fehlt !== null) unter.append(`fehlt bei diesem Start: ${fehlt}`);
    else {
      if (weg) unter.append(weg);
      if (groesse) unter.append(nachZahl("k15tzg", `${weg ? " · " : ""}${groesse}`));
    }
    const x = el("span", "k15x");
    x.append(...[
      `Tut: ${b.satz}`, b.breaksWithout ? `Ohne: ${b.breaksWithout}` : "",
      b.grenze.art === "noetig" ? `${b.grenze.gesperrt ? "Gesperrt" : "Pflicht"}, weil: ${b.grenze.grund}` : "",
      traegt ? `Nicht einstellbar, weil: ${bausteinName(traegt)} steckt darin und ist Pflicht; ohne dies käme es bei diesem Start nicht an.` : "",
      !b.harness.gueltig && b.harness.grund ? `Gilt nicht für diesen Agenten: ${b.harness.grund}` : "",
      !b.schaltbar.ja ? `Nicht schaltbar: ${b.schaltbar.grund}` : "",
      b.bedingung ? `Nur wenn: ${b.bedingung.grund} (${b.bedingung.erfuellt === "unknown" ? "erst beim Start bekannt" : b.bedingung.erfuellt ? "trifft zu" : "trifft nicht zu"})` : "",
      eigen ? `Standard (${p.name}${q ? ` v${p.v}` : ""}): ${lg.unten[b.id] ?? std} → hier: ${b.zustand}` : "",
    ].filter(Boolean).map((z) => el("span", "", z)));
    tt.append(kopf, ...(unter.childNodes.length ? [unter] : []), x);
    const info = el("button", "k15info");
    info.title = `${bausteinName(b)}: was er tut, was ohne ihn bricht`;
    info.setAttribute("aria-label", info.title);
    info.setAttribute("aria-expanded", String(s.offen.has(key)));
    info.append(icon("info"));
    info.onclick = () => zeige(key);
    // ein Klick auf die Zeile springt in Spalte 4 genau an diesen Baustein (Owner 11:1x: „[Zitat entfernt]“)
    r.tabIndex = 0;
    r.setAttribute("role", "button");
    r.onclick = (e) => { if (!(e.target instanceof Element && e.target.closest("button"))) springe(b.id); };
    r.onkeydown = (e) => { if (e.target === r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); springe(b.id); } };
    const grund = pflicht ? "Pflicht" : traegt ? `trägt ${bausteinName(traegt)}` : !b.harness.gueltig ? "gilt nicht für diesen Agenten" : !b.schaltbar.ja ? "nicht schaltbar"
      : wer && wer.art !== "du" ? wer.grund : "";
    if (fehlt !== null) { r.append(tt, info, el("span", "k15togleer")); return r; }
    const sw = schalt(an, frei ? `${bausteinName(b)} ${an ? "an" : "aus"}` : `${bausteinName(b)}: ${grund}`, () => { if (frei) void setzeBaustein(s, q, p, b, !an); });
    if (!frei) sw.classList.add("fest");
    r.append(tt, info, sw);
    return r;
  };
  // EIN KONTEXTPACK ALS ENTWURF steht in Wissen wie ein Pack, mit Kennzeichen „Entwurf“: wo er bei dieser Rolle landete, und dass Fleet
  // ihn heute nicht mitgibt. Ein Klick öffnet ihn in Spalte 4.
  const entwurfZeile = (pk: PackEntwurf, an0: Answer): HTMLElement => {
    const la = packLandung(pk, p.rolle, an0);
    const r = el("div", "k15tz k15entw aus");
    r.dataset.pack = pk.id;
    const tt = el("span", "k15kt");
    const kopf = el("span", "k15tzk");
    kopf.append(el("span", "k15tzn", pk.name), el("span", "k15tag entw", "Entwurf"), ...(pk.v ? [el("span", "k15tag ver", `v${pk.v}`)] : []));
    const unter = el("span", "k15tzp");
    if (la.art === "nicht") unter.append(la.grund);
    else unter.append(`in Lesehinweise · ${la.ort === "text" ? "als Text" : "auf Abruf"} · heute gibt Fleet ihn nicht mit`,
      nachZahl("k15tzg", ` · ${tokVon(packBytes(pk, la.ort))}`));
    tt.append(kopf, unter);
    r.append(tt, icon("chevron"));
    r.tabIndex = 0;
    r.setAttribute("role", "button");
    r.title = `${pk.name}: Entwurf öffnen`;
    r.onclick = () => oeffnePack(s, pk);
    r.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffnePack(s, pk); } };
    return r;
  };

  // DER DETAILGRAD (Owner 12:3x): Gruppen zu oder auf; die Wahl gilt für die ganze Spalte und bleibt im Browser
  const detail = el("div", "k15detail");
  const seg = el("div", "k15seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Detailgrad");
  for (const d of DETAILS) {
    const b = el("button", s.detail === d.id ? "on" : "", d.wort);
    b.setAttribute("aria-pressed", String(s.detail === d.id));
    b.onclick = () => setzeDetail(s, d.id);
    seg.append(b);
  }
  detail.append(el("span", "k15zk", "Detailgrad"), seg);
  col.append(detail);

  // DIE GRUPPEN (Owner 12:3x „[Zitat entfernt]“): je Gruppe ihr Satz, wie viel davon an ist und eine Spur aus Kästchen,
  // eines je Baustein (kräftig = Pflicht, mittel = Standard der Rolle, blass = lässt sich dazuschalten, gestrichelt = hier nicht
  // schaltbar; gefüllt = an; ein Klick springt in Spalte 4 an den Baustein); ihre Tokens beim Darüberfahren. Einen Regler hat nur eine
  // Gruppe mit mindestens zwei freien Bausteinen (src/k15-entwurf-modell.ts#hatRegler).
  const gruppeBlock = (gr: (typeof GRUPPEN)[number], bs: Baustein[], lg: Lage, an0: Answer, va: Answer | null, eigenB: Map<string, number>,
    extra: HTMLElement[]): HTMLElement => {
    const key = s.detail === "gruppen" ? `g+:${gr.id}` : `g-:${gr.id}`;
    const auf = s.detail === "gruppen" ? s.offen.has(key) : !s.offen.has(key);
    const box = el("section", `k15gr${auf ? " auf" : ""}`);
    box.dataset.g = gr.id;
    const anB = bs.filter((b) => kommtAn(an0, b));
    const bytes = bs.filter((b) => b.zustand === "an").reduce((m, b) => m + (eigenB.get(b.id) ?? 0), 0);
    const kopfz = el("button", "k15grk");
    kopfz.setAttribute("aria-expanded", String(auf));
    kopfz.append(icon("chevron"), el("span", "k15grn", gr.wort), el("span", "k15grz", `${anB.length} von ${bs.length} an`), nachZahl("k15grt", tokVon(bytes)));
    kopfz.onclick = () => { if (s.offen.has(key)) s.offen.delete(key); else s.offen.add(key); render(); };
    // was die Gruppe im Lauf tut, sichtbar; wofür sie da ist und die Fundstelle im Title; wo man sie einstellt beim Darüberfahren (Runde 4, Z63)
    const lauf = el("div", "k15grs", gr.lauf[p.rolle]);
    lauf.title = `${gr.wort}: ${gr.satz}\nFundstelle: ${gr.fund}`;
    const wo = el("div", "k15x k15grw");
    wo.append(el("span", "", `Einstellen: ${gr.wo}`));
    box.append(kopfz, lauf, wo);
    const std = new Map((va?.plan.bausteine ?? []).map((b) => [b.id, b.zustand]));
    const spur = el("div", "k15spur");
    spur.style.setProperty("--n", String(bs.length));
    for (const b of bs) {
      const art = (b.grenze.art === "noetig" || traeger.has(b.id)) && b.zustand === "an" ? "pflicht" : !(b.schaltbar.ja && b.harness.gueltig) ? (b.zustand === "an" ? "pflicht" : "fest")
        : std.get(b.id) === "an" ? "std" : "dazu";
      const c = el("button", `k15rc ${art}${kommtAn(an0, b) ? " an" : ""}`);
      c.dataset.id = b.id;
      c.title = `${bausteinName(b)}: ${kommtAn(an0, b) ? "an" : fehltWeil(an0, b) !== null ? "fehlt bei diesem Start" : "aus"}${art === "pflicht" ? (b.grenze.art === "noetig" ? ", Pflicht" : traeger.has(b.id) ? ", trägt eine Pflicht" : ", nicht schaltbar") : art === "dazu" ? ", lässt sich dazuschalten" : art === "fest" ? ", hier nicht schaltbar" : ""}`;
      c.setAttribute("aria-label", c.title);
      c.onclick = () => springe(b.id);
      spur.append(c);
    }
    box.append(spur);
    const r = lg.regler[gr.id];
    if (r) {
      const anIds = new Set(bs.filter((b) => b.zustand === "an").map((b) => b.id));
      const jetzt = stufeAus(anIds, r);
      const gewaehltSt = lg.umfang[gr.id] ?? "standard";
      const profilStufe = umfangVon(p, null, gr.id);
      const reg = el("div", `k15regler${s.offen.has(`x:regler:${gr.id}`) ? " zeig" : ""}`);
      const stufen = el("div", "k15seg k15stufen");
      stufen.setAttribute("role", "radiogroup");
      stufen.setAttribute("aria-label", `Wie viel ${gr.wort}`);
      for (const st of STUFEN.filter((x) => x.id !== "alles" || r.dazu.length > 0)) {
        const b = el("button", `${jetzt === st.id ? "on" : ""}${gewaehltSt === st.id ? " gewaehlt" : ""}`, st.wort);
        b.title = st.satz;
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(jetzt === st.id));
        b.onclick = () => setzeUmfang(s, q, p, gr.id, st.id, bs.map((x) => x.id));
        stufen.append(b);
      }
      const rk = el("div", "k15rkopf");
      rk.append(el("span", "k15rk", `Wie viel ${gr.wort}`), stufen);
      if (jetzt === null) rk.append(el("span", "k15zsub", "eigene Auswahl"));
      if (q && gewaehltSt !== profilStufe) rk.append(el("span", "k15mark"));
      const ex = el("span", "k15x");
      ex.append(...[
        `${plural(r.pflicht.length, "Pflicht-Baustein", "Pflicht-Bausteine")} · ${r.std.length} im Standard · ${r.dazu.length} dazuschaltbar`,
        jetzt === null ? `Einzelne Schalter weichen von „${stufeWort(gewaehltSt)}“ ab.` : "",
        q && gewaehltSt !== profilStufe ? `Standard (${p.name} v${p.v}): ${stufeWort(profilStufe)} → hier: ${stufeWort(gewaehltSt)}` : "",
      ].filter(Boolean).map((z) => el("span", "", z)));
      reg.append(rk, ex);
      box.append(reg);
    }
    if (auf) {
      const zeilen = el("div", "k15grp");
      for (const b of bs) {
        if (b.id.startsWith("pack:")) continue;
        zeilen.append(bausteinZeile(b, lg, an0));
        if (b.id === "context-anchors") zeilen.append(...extra);
      }
      if (!bs.some((b) => b.id === "context-anchors")) zeilen.append(...extra);
      box.append(zeilen);
    }
    return box;
  };

  if (!l || !a) {
    const st = l ? (l.plan === "laedt" ? "laedt" : l.plan) : null;
    const satz = !s.repo ? "Kein Repo: Hier steht der Plan, sobald oben ein Repo gewählt ist."
      : st === "laedt" ? `Der Gründungsplan von ${baseName(s.repo)} wird gelesen …`
      : `Der Plan lehnt ab: ${st && typeof st === "object" && "fehler" in st ? st.fehler : "unbekannt"}`;
    gruppe("Was sie bekommt", null, null, [el("div", "k15leer", satz)]);
    if (q && st && typeof st === "object" && "fehler" in st && q.schalter) {
      const z = el("button", "k15ghost", "Schalter dieser Session verwerfen");
      z.onclick = () => { delete q.schalter; render(); };
      col.append(z);
    }
  } else {
    const va = antwort(l.voll);
    const eigene = bausteineVon(a, l).filter((b) => b.id !== EINSTELLUNGEN_ID);
    const fremde = a.plan.bausteine.filter((b) => !b.id.startsWith("pack:") && b.id !== EINSTELLUNGEN_ID && !eigene.includes(b));
    // ein Pack ohne Quelle (omitted) lässt sich nicht anschalten; der Plan nennt es, die Gruppe zählt es nicht
    const ohneQuelle = new Set(a.omitted.map((o) => `pack:${o.id}`));
    const packs = a.plan.bausteine.filter((b) => b.id.startsWith("pack:"));
    const packsHier = packs.filter((b) => b.zustand === "an" || !ohneQuelle.has(b.id));
    const packsAn = packs.filter((b) => b.zustand === "an");
    const rolle = p.rolle;
    const entwuerfe = istPackRolle(rolle) ? s.packs.filter((pk) => pk.orte[rolle] !== "nicht") : [];
    const packZeile = packs.length ? zeile({ k: "Context Packs", v: `${packsAn.length} von ${packs.length} an${entwuerfe.length ? ` · ${plural(entwuerfe.length, "Entwurf", "Entwürfe")}` : ""}`,
      quelle: "packs", sub: "stecken in Lesehinweise",
      erkl: [packsAn.length ? packsAn.map((b) => PACK_WORDS[b.id.slice(5)]?.name ?? b.id.slice(5)).join(" · ") : "keins gewählt",
        "Der Plan wählt Packs nach Auslöser, Agent und Rolle, nicht nach einer festen Liste."], innen: "context-plan.ts" }) : null;
    packZeile?.classList.add("k15innen");
    const extra = [...(packZeile ? [packZeile] : []), ...entwuerfe.map((pk) => entwurfZeile(pk, a))];
    extra.forEach((x) => x.classList.add("k15innen"));
    const eigenB = eigeneBytes(a);
    const grs = el("div", "k15grs0");
    for (const gr of GRUPPEN) {
      const bs = [...eigene.filter((b) => gruppeVon(b) === gr.id), ...packsHier.filter((b) => gruppeVon(b) === gr.id)];
      if (bs.length) grs.append(gruppeBlock(gr, bs, l, a, va, eigenB, gr.id === "wissen" ? extra : []));
    }
    const sec = el("div", "k15sec");
    sec.append(el("span", "k15secw", "Was sie bekommt"));
    const l4 = el("button", `k15glink${s.quelle === "landet" ? " on" : ""}`);
    l4.append(el("span", "", "Wo es landet"), icon("chevron"));
    l4.onclick = () => { s.quelle = "landet"; gehe(3, 3); };
    sec.append(l4);
    col.append(sec, grs);
    // FEHLT EIN THEMA? (Owner 16.10.: „[Zitat entfernt]“) Nur bei einer Rolle, die Lesehinweise bekommt
    if (istPackRolle(p.rolle)) {
      const neu = el("button", "k15ghost k15packneu");
      neu.append(icon("plus"), el("span", "", "Kontextpack anlegen"));
      neu.title = "Fehlt dieser Session ein Thema, schreib es als Pack; du wählst, welche Rollen ihn bekommen.";
      neu.onclick = () => oeffnePack(s, null);
      const z = el("div", "k15packz");
      z.append(neu, el("span", "k15labs", "Fehlt ein Thema? Ein Pack kommt in die Lesehinweise der Rollen, die du wählst."));
      col.append(z);
    }
    if (fremde.length) {
      const box = el("div", "k15grp k15fremd");
      box.append(zeile({ k: "Nicht in dieser Rolle", v: plural(fremde.length, "Baustein", "Bausteine"),
        erkl: [p.rolle === "nur-ordner" ? "Eine Session ohne Rolle bekommt diese Bausteine nicht:" : "Diese Bausteine schaltet der Plan nur für andere Rollen an:", fremde.map(bausteinName).join(" · ")] }));
      col.append(box);
    }
    // „<id> ist im Plan <zustand>, diese Tuer liefert es trotzdem (<weg>)“ (server.ts#planDoorVerdict), mit den Namen des Plans
    const trotzdem = a.start.refusals.map((x) => /^(\S+) ist im Plan \S+, diese Tuer liefert es trotzdem \((.+)\)$/.exec(x))
      .map((m) => { const b =m ? a.plan.bausteine.find((y) => y.id === m[1]) : undefined; return b && m ? `${bausteinName(b)} (${m[2]})` : ""; }).filter(Boolean);
    if (trotzdem.length) col.append(el("div", "k15hinweis", `Die Tür liefert trotzdem, was der Plan abschaltet: ${trotzdem.join(" · ")}.`));
  }

  // EINSTELLUNGEN · Agent, Modell, Effort, Succession und Permission-Mode, je mit Herkunft in Menschenworten (Datei und Funktion im Title).
  // Agenten, Modelle und Effort-Stufen kommen aus dem Katalog des Servers (src/k15-agent.ts); die Modell-Liste folgt dem Agenten (Runde 4)
  const ag = wahlVon(s, p, q, "agent"), m = wahlVon(s, p, q, "modell"), e = wahlVon(s, p, q, "effort"), sw = schwelleWahl(s, p, q);
  const kat = s.katalog;
  const abwVon = (f: Feld): string | undefined => q?.abw?.[f] === undefined ? undefined
    : f === "schwelle" ? pct(typeof p.schwelle === "number" ? p.schwelle : schwelleVon(p.schiene, s.env ?? null).pct)
    : typeof p[f] === "string" ? (f === "agent" ? agentWort(String(p[f])) : f === "modell" ? modelLabel(String(p[f])) : EFFORT_WORT[String(p[f])] ?? String(p[f])) : "Standard";
  const ohneKatalog = kat === undefined ? "wird gelesen" : "Fleet nennt die Agenten nicht";
  const modelle = kat ? modelleVon(kat, ag.wert) : [], efforts = kat ? effortVon(kat, ag.wert) : [];
  gruppe("Einstellungen", p.einV, "einst", [
    zeile({ k: "Agent", v: ag.wort, erkl: [ag.herkunft], innen: ag.quelle, abw: abwVon("agent"),
      ...(kat ? { wahl: { optionen: agentOptionen(kat, p.rolle === "lane"), jetzt: ag.wert, nimmt: (neu) => setze(s, q, p, "agent", neu) } } : { sub: ohneKatalog }) }),
    zeile({ k: "Modell", v: m.wort, erkl: [m.herkunft], innen: m.quelle, abw: abwVon("modell"),
      ...(modelle.length ? { wahl: { optionen: modelle.map((x) => ({ wert: x, wort: modelLabel(x) })), jetzt: m.wert, nimmt: (neu) => setze(s, q, p, "modell", neu) } }
        : { sub: kat ? `${ag.wort} nennt keine Liste` : ohneKatalog }) }),
    zeile({ k: "Effort", v: e.wort, erkl: [e.herkunft], innen: e.quelle, abw: abwVon("effort"),
      ...(efforts.length ? { wahl: { optionen: efforts.map((x) => ({ wert: x, wort: EFFORT_WORT[x] ?? x })), jetzt: e.wert, nimmt: (neu) => setze(s, q, p, "effort", neu) } }
        : { sub: kat ? `${ag.wort} kennt keine Stufen` : ohneKatalog }) }),
    zeile({ k: "Succession ab", v: pct(sw.pct), erkl: [sw.herkunft], innen: sw.quelle, abw: abwVon("schwelle"),
      wahl: { optionen: SCHWELLEN.map((x) => ({ wert: String(x), wort: pct(x) })), jetzt: String(sw.pct ?? ""), nimmt: (neu) => setze(s, q, p, "schwelle", Number(neu)) } }),
    zeile({ k: "Permission-Mode", v: String(aspekt("permission-mode")?.standard ?? ""), sub: "für alle Sessions gleich",
      erkl: ["Fleet startet jede Claude-Session im Auto-Mode: ein Klassifizierer prüft jede Aktion, statt nachzufragen; was er sperrt, meldet die Session ihrer Leitung.",
        "Je Rolle einstellbar wird er erst, wenn jede Session ihre eigene Startzeile bekommt."], innen: aspekt("permission-mode")?.heute }),
  ]);

  // SYSTEMPROMPT UND RECHTE · was Claude Code selbst in den Start legt, aufgeschlüsselt (src/k15-anatomie-ui.ts) wie in Spalte 4; ein älterer
  // Server liefert nur die Zeilen von Claude Code (claudeCode.zeilen)
  const cca = a ? anatomieVon(a.claudeCode) : null;
  const ccZeile = (id: string) => {
    const g = cca?.gruppen.find((x) => x.id === id);
    if (!cca || !g?.teile.length) return [];
    const { bytes, offen } = gruppenBytes(g);
    return [zeile({ k: g.wort, v: zaehlung(g), quelle: "rechte", innen: quelleSatz(cca),
      erkl: [g.satz, ...(zaehltMit(g) ? [`Beim Start ${tokCc(bytes, cca) || "0 Tok"}${offen ? `, ${offen} nicht gemessen` : ""}`] : [])] })];
  };
  if (cca) gruppe("Systemprompt", null, "rechte", [...ccZeile("systemprompt"), ...ccZeile("fleet")]);
  const cc = a?.claudeCode?.zeilen ?? [];
  const rechte = cca ? ["werkzeuge", "skills", "agenten", "plugins", "mcp"].flatMap(ccZeile)
    : (["werkzeuge", "listen", "mcp"] as const).map((id) => cc.find((z) => z.id === id)).filter((z): z is NonNullable<typeof z> => !!z)
      .map((z) => zeile({ k: z.wort, v: z.wert, ...(istSchalter(z.weg) ? {} : { sub: z.weg }), quelle: "rechte", erkl: [z.satz],
        innen: istSchalter(z.weg) ? `Claude Code: ${z.weg} · ${z.quelle}` : z.quelle }));
  gruppe("Rechte", p.rechteV, null, rechte.length ? rechte : [el("div", "k15leer", a ? "Der Plan nennt für diesen Agenten keine Claude-Code-Zeilen." : "wird mit dem Plan gelesen")]);

  // VERBINDUNGEN IM LAUF · was das Register nicht abdeckt: Postfach, Rückweg, Succession, Hinweise, Ausweis
  gruppe("Verbindungen im Lauf", null, "wege", verbindungen(p.id).map((v) => zeile({ k: v.name, v: v.kurz, quelle: "wege",
    ...(v.fehlt ? { sub: "heute nicht" } : {}), erkl: [v.heute, ...(v.fehlt ? [v.fehlt] : [])], innen: v.quelle })));

  const fuss = el("div", "k15sfuss");
  const nichtGebaut = () => toast("Entwurf: Speichern baut erst der Server-Teil. Bis zum Neuladen bleibt die Änderung hier.");
  if (q && abwZahl(q)) {
    fuss.append(el("span", "k15labs", `${plural(abwZahl(q), "Abweichung", "Abweichungen")} vom Profil ${p.name} v${p.v}`));
    const sp = el("button", "k15ghost", `Als ${p.name} v${p.v + 1} speichern`);
    sp.onclick = nichtGebaut;
    const b = el("button", "k15ghost", "Verwerfen");
    b.onclick = () => { delete q.abw; delete q.werteAbw; delete q.schalter; delete q.ohne; delete q.datei; render(); };
    fuss.append(sp, b);
  } else if (!q && s.profilNeu.has(p.id)) {
    fuss.append(el("span", "k15labs", "ungespeicherte Änderung am Profil"));
    const sp = el("button", "k15ghost", `Als v${p.v + 1} speichern`);
    sp.onclick = nichtGebaut;
    fuss.append(sp);
  }
  if (q && alle(s.k.wurzeln).length > 1) {
    const r = el("button", "k15ghost k15weg", "Aus dem Aufbau nehmen");
    r.onclick = () => entferne(s, q);
    fuss.append(r);
  }
  if (fuss.childElementCount) col.append(fuss);
  return col;
}

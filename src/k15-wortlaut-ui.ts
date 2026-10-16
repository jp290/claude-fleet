// K15 · SPALTE 4, DER WORTLAUT (Modell: src/k15-wortlaut.ts): was die gewählte Session als Text bekommt, Abschnitt für Abschnitt, je mit
// dem Baustein, aus dem er kommt. Steht etwas falsch, ändert man den Abschnitt als eigene Fassung; fehlt ein Thema, legt man einen
// Kontextpack an (Owner 16.10.: „[Zitat entfernt]“
// ). Vorne stehen Menschenworte; Datei und Anker eines Abschnitts stehen im Title.
import { el, bausteinName } from "./k15-haupt";
import { icon } from "./icons";
import type { Answer } from "./founding";
import { DU, ORTE, fmt, tokVon, undListe, type Abschnitt, type Position, type Profil } from "./k15-entwurf-modell";
import { bloeckeVon, schluessel, textBasis, veraltet, type Block, type TextBlock, type TextFassung } from "./k15-wortlaut";
import { istPackRolle } from "./k15-kontextpack";
import { gewaehlt, plural, render, speichereEigenes, toast, zeige, type St } from "./k15-zustand";
import { chip, istSchalter, kennzeichen, nachZahl, qLeiste, qTitel, schalt, unterkopf } from "./k15-teile";

// die Abschrift der AGENTS.md (Claude Code lädt sie selbst) und eine eigene Datei (gibt Fleet heute nicht mit) als Text-Blöcke mit Adresse.
// Die Fassung einer Abschrift gehört dem Profil, die einer eigenen Datei der Datei (k15-wortlaut.ts#schluessel).
function nativBloecke(abs: Abschnitt[], fassungen: ReadonlyMap<string, TextFassung>, wem: string): TextBlock[] {
  return abs.filter((x) => x.text).map((x) => {
    const abschnitt = `AGENTS.md### ${x.titel}`;
    const fkey = schluessel(wem, abschnitt);
    const eigen = fassungen.get(fkey) ?? null;
    return { art: "text", key: `nativ:${x.titel}`, titel: x.titel, fleet: x.text, text: eigen?.text ?? x.text, abschnitt, fassung: null, teil: null,
      spannen: [{ baustein: "native-agents", von: 0, bis: x.text.length }], eigen, bytes: x.bytes ?? null, fkey, basis: textBasis(x.text) };
  });
}
function dateiBloecke(d: { id?: string; titel: string; abschnitte: Abschnitt[] }, fassungen: ReadonlyMap<string, TextFassung>): TextBlock[] {
  return d.abschnitte.filter((x) => x.text).map((x) => {
    const abschnitt = `${d.titel}#${x.titel}`;
    const fkey = schluessel(`datei:${d.id ?? d.titel}`, abschnitt);
    const eigen = fassungen.get(fkey) ?? null;
    return { art: "text", key: `datei:${x.titel}`, titel: x.titel, fleet: x.text, text: eigen?.text ?? x.text, abschnitt, fassung: null, teil: null,
      spannen: [{ baustein: "eigene-datei", von: 0, bis: x.text.length }], eigen, bytes: x.bytes ?? null, fkey, basis: textBasis(x.text) };
  });
}
// alle Blöcke, die der Wortlaut der gewählten Session zeigt
function wortlaut(s: St, p: Profil, q: Position | null, a: Answer): { datei: TextBlock[]; sa: Block[]; nativ: TextBlock[] } {
  const name = (id: string) => { const b = a.plan.bausteine.find((x) => x.id === id); return b ? bausteinName(b) : id; };
  return { datei: q?.datei ? dateiBloecke(q.datei, s.fassungen) : [], sa: bloeckeVon(a, p.rolle, name, s.fassungen, p.id),
    nativ: p.nativ ? nativBloecke(p.nativ.abschnitte, s.fassungen, p.id) : [] };
}
// je Baustein die höchste Nummer einer eigenen Fassung eines seiner Abschnitte (Spalte 3 trägt dann „eigene vN“)
export function eigeneVon(s: St, p: Profil, q: Position | null, a: Answer): Map<string, number> {
  const out = new Map<string, number>();
  const w = wortlaut(s, p, q, a);
  for (const b of [...w.sa, ...w.nativ]) if (b.art === "text" && b.eigen) for (const x of b.spannen) out.set(x.baustein, Math.max(out.get(x.baustein) ?? 0, b.eigen.v));
  return out;
}

function sichereFassung(s: St, b: TextBlock, text: string): void {
  const alt = s.fassungen.get(b.fkey);
  s.bearbeite = null;
  s.bearbeiteText = null;
  if (text === (alt?.text ?? b.fleet)) { toast("Unverändert: Es gibt keine neue Fassung."); render(); return; }
  const neu = new Map(s.fassungen);
  const v = (alt?.v ?? 0) + 1;
  if (text === b.fleet) neu.delete(b.fkey);
  else neu.set(b.fkey, { abschnitt: b.fkey, teil: b.teil, v, text, basis: b.basis, am: Date.now(), autor: DU });
  s.fassungen = neu;
  // der Satz erst, wenn der Server bestätigt hat
  void speichereEigenes(s).then((ok) => {
    if (ok) toast(text === b.fleet ? `„${b.titel}“ ist wieder wie Fleets Text; deine eigene Fassung ist verworfen.` : `Eigene Fassung v${v} von „${b.titel}“ gesichert. Fleets Text bleibt, wie er ist.`);
  });
  render();
}
// der Editor bekommt den Fokus einmal, wenn er aufgeht; danach hält ihn das Neuzeichnen, wo er ist (k15-entwurf.ts#render)
let fokussiert: string | null = null;
// DER EDITOR einer eigenen Fassung: derselbe Text zum Ändern; Fleets Text bleibt, wie er ist. Was man tippt, steht sofort im Zustand
// (s.bearbeiteText), so übersteht es jedes Neuzeichnen.
function abschnittEditor(o: { feld: string; titel: string; text: string; v: number; tippe: (text: string) => void; sichern: (text: string) => void; abbrechen: () => void }): HTMLElement {
  const box = el("div", "k15edit");
  box.append(el("div", "k15editk", `Eigene Fassung v${o.v} von „${o.titel}“. Fleets Text bleibt, wie er ist. Heute schickt Fleet noch die Vorlage; die eigene Fassung mitzugeben ist Schritt 4.`));
  const ta = document.createElement("textarea");
  ta.className = "k15editt";
  ta.value = o.text;
  ta.spellcheck = false;
  ta.setAttribute("aria-label", `Text von ${o.titel}`);
  ta.dataset.feld = o.feld;
  ta.oninput = () => o.tippe(ta.value);
  const knoepfe = el("div", "k15row2");
  const ok = el("button", "k15ghost k15editok", `Als eigene v${o.v} sichern`);
  ok.onclick = () => o.sichern(ta.value);
  const ab = el("button", "k15ghost", "Abbrechen");
  ab.onclick = o.abbrechen;
  knoepfe.append(ok, ab);
  box.append(ta, knoepfe);
  requestAnimationFrame(() => { ta.style.height = `${ta.scrollHeight + 4}px`; if (fokussiert !== o.feld) { fokussiert = o.feld; ta.focus({ preventScroll: true }); } });
  return box;
}

// wo die Session-Datei bei dieser Rolle ankommt: nur eine Lane bekommt eine Datei, MAIN und Orchestratorin dieselben Teile in der
// ersten Nachricht (server.ts#planDoorRow)
function teilOrt(a: Answer): { wort: string; satz: string } {
  const wege = new Set((a.lieferung?.geliefert ?? []).map((x) => x.weg));
  const o = ORTE.find((x) => x.weg === (wege.has("Session-Datei") ? "Session-Datei" : wege.has("Prompt") ? "Prompt" : "Session-Datei"));
  return { wort: o?.wort ?? "Session-Datei", satz: o?.satz ?? "" };
}

export function wortlautAnsicht(s: St, a: Answer, pack: () => void): HTMLElement[] {
  const { q, p } = gewaehlt(s);
  const out: HTMLElement[] = [];
  const name = (id: string): string => {
    if (id === "eigene-datei") return "Eigene Datei";
    const b = a.plan.bausteine.find((x) => x.id === id);
    return b ? bausteinName(b) : id;
  };
  // EIN ABSCHNITT: Kopf mit Name, Kennzeichen einer eigenen Fassung und Größe (beim Darüberfahren); darunter der Baustein, aus dem er
  // kommt, und der Text, oder der Editor einer eigenen Fassung
  const blockZeile = (b: TextBlock, schalter?: Position) => {
    const ohne = schalter?.ohne ?? [];
    const offen = s.offen.has(b.key) || s.bearbeite === b.fkey;
    const alt = veraltet(b);
    const aus = ohne.includes(b.key);
    const r = el("div", `k15abs${offen ? " open" : ""}${aus ? " aus" : ""}`);
    r.dataset.abschnitt = b.abschnitt;
    const kopf = el("button", "k15absh");
    kopf.setAttribute("aria-expanded", String(offen));
    kopf.append(icon("chevron"), el("span", "k15absn", b.titel.replace(/^#+\s*/, "")), ...(b.eigen ? kennzeichen({ art: "eigen" }, b.eigen.v) : []),
      ...(alt ? [el("span", "k15tag alt", "Fleet geändert")] : []),
      nachZahl("k15abst", typeof b.bytes === "number" ? tokVon(b.bytes) : ""));
    kopf.onclick = () => { if (offen) { s.offen.delete(b.key); if (s.bearbeite === b.fkey) { s.bearbeite = null; s.bearbeiteText = null; } } else s.offen.add(b.key); render(); };
    r.append(kopf);
    if (schalter) r.append(schalt(!aus, aus ? `${b.titel} ginge nicht mit (Schritt 4)` : `${b.titel} geht mit`, () => {
      const rest = aus ? ohne.filter((y) => y !== b.key) : [...ohne, b.key];
      if (rest.length) schalter.ohne = rest; else delete schalter.ohne;
      s.konstNeu.add(s.k.id);
      render();
    }));
    if (offen) {
      const body = el("div", "k15absb");
      const namen = [...new Set(b.spannen.map((x) => name(x.baustein)))];
      const herkunft = el("div", "k15qd k15absw", namen.length > 1 ? `Aus den Bausteinen ${undListe(namen)}; Fleet schickt sie als einen Abschnitt.` : `Aus dem Baustein ${namen[0] ?? "?"}.`);
      herkunft.title = b.abschnitt.replace("#", " · ");
      body.append(herkunft);
      // Fleets Text hat sich geändert, seit die eigene Fassung entstand: das sagt die Fassung selbst (Prüfung Punkt 5)
      if (alt) body.append(el("div", "k15hinweis", "Fleets Text hat sich geändert, seit du diese Fassung geschrieben hast. „Fleets Text zeigen“ zeigt den neuen Stand; sicherst du die Fassung noch einmal, setzt sie auf ihm auf."));
      if (s.bearbeite === b.fkey) {
        body.append(abschnittEditor({ feld: `wl:${b.fkey}`, titel: b.titel.replace(/^#+\s*/, ""), text: s.bearbeiteText ?? b.text, v: (b.eigen?.v ?? 0) + 1,
          tippe: (t) => { s.bearbeiteText = t; }, sichern: (t) => sichereFassung(s, b, t), abbrechen: () => { s.bearbeite = null; s.bearbeiteText = null; render(); } }));
      } else {
        const fleetZeigen = !!b.eigen && s.offen.has(`fleet:${b.fkey}`);
        body.append(el("pre", "k15pre", fleetZeigen ? b.fleet : b.text));
        const akt = el("div", "k15absa");
        const bea = el("button", "k15link", b.eigen ? `Bearbeiten (eigene v${b.eigen.v})` : "Bearbeiten");
        bea.title = "eine eigene Fassung dieses Abschnitts; Fleets Text bleibt, wie er ist";
        bea.onclick = () => { s.bearbeite = b.fkey; s.bearbeiteText = null; render(); };
        akt.append(bea);
        if (b.eigen) {
          const fz = el("button", "k15link", fleetZeigen ? "deine Fassung zeigen" : "Fleets Text zeigen");
          fz.onclick = () => zeige(`fleet:${b.fkey}`);
          akt.append(fz, el("span", "k15labs", `eigene v${b.eigen.v} · heute schickt Fleet noch die Vorlage (Schritt 4)`));
        }
        body.append(akt);
      }
      r.append(body);
    }
    out.push(r);
  };
  const teilKopf = (glyph: "file" | "list", t: string, v: number | null, say: string, rechts?: HTMLElement) => {
    const h = el("div", "k15teil");
    const g = el("span", "k15teilg");
    g.append(icon(glyph));
    const tt = el("span", "k15kt");
    const n = el("span", "k15teiln");
    const nn = el("span", "", t);
    nn.title = t;
    n.append(nn);
    if (v !== null) n.append(chip(v));
    tt.append(n, el("span", "k15qd", say));
    h.append(g, tt);
    if (rechts) h.append(rechts);
    out.push(h);
  };

  out.push(...qTitel(q ? `Start von ${q.name}` : `Start einer Session mit Profil ${p.name}`, null, a.plan.planSatz));
  // VERSTEHEN, ÄNDERN, ERGÄNZEN: was es gibt, liest man hier; ein Abschnitt lässt sich ändern; fehlt ein Thema, kommt ein Pack dazu
  const hilfe = el("div", "k15wlh");
  hilfe.append(el("span", "", "Je Abschnitt steht, aus welchem Baustein er kommt. Steht etwas anders, als du es willst, bearbeite den Abschnitt."));
  if (istPackRolle(p.rolle)) {
    const pk = el("button", "k15link", "Fehlt ein Thema? Kontextpack anlegen");
    pk.onclick = pack;
    hilfe.append(pk);
  }
  out.push(hilfe);
  const w = wortlaut(s, p, q, a);
  // die eigene Datei: heute gibt Fleet sie nicht mit (Schritt 4); der Entwurf zeigt, wo sie stünde
  if (q?.datei) {
    const weg = el("button", "k15link", "entfernen");
    weg.onclick = () => { delete q.datei; s.konstNeu.add(s.k.id); render(); };
    teilKopf("file", q.datei.titel, q.datei.v, `${q.datei.pfad} · heute gibt Fleet sie nicht mit (Schritt 4)`, weg);
    for (const b of w.datei) blockZeile(b);
  } else if (q) {
    const d = el("div", "k15drop k15drop2");
    d.append(icon("file"), el("span", "", "Eigene Datei: eine .md hierher ziehen. Sie stünde vor dem, was Fleet schreibt; mitgeben kann Fleet sie erst mit Schritt 4."));
    out.push(d);
  }
  // was Fleet für diese Rolle schreibt, Abschnitt für Abschnitt: bei einer Lane als Session-Datei, sonst in der ersten Nachricht
  const sa = a.sessionAgents;
  const texte = w.sa.filter((b): b is TextBlock => b.art === "text");
  if (sa && texte.length) {
    const ort = teilOrt(a);
    teilKopf("list", ort.wort, null, `von Fleet geschrieben · ${plural(texte.length, "Abschnitt", "Abschnitte")}`);
    out.push(qLeiste(ort.satz ? `${ort.satz.charAt(0).toUpperCase()}${ort.satz.slice(1)}.` : "", texte.map((b) => b.key)));
    // ein Zwischentitel, der nur den Namen des folgenden Abschnitts wiederholt („Rolle“), fällt weg
    w.sa.forEach((b, i) => {
      const nach = w.sa[i + 1];
      if (b.art === "zwischen") { if (!(nach?.art === "text" && nach.titel === b.titel)) out.push(el("div", "k15absg", b.titel)); }
      else blockZeile(b, q ?? undefined);
    });
    if (q?.ohne?.length) out.push(el("div", "k15hinweis", "Abschnitte einzeln weglassen geht heute nicht: Den Text setzt der Server zusammen (Schritt 4, Stopp)."));
  } else {
    teilKopf("list", "Nichts von Fleet", null, "Fleet schreibt dieser Rolle keinen Text; Claude Code lädt den Ordner selbst.");
  }
  if (p.nativ) {
    teilKopf("file", p.nativ.titel, p.nativ.v, `${p.nativ.pfad} · lädt Claude Code selbst`);
    out.push(qLeiste(`${p.nativ.abschnitte.length} Abschnitte`, w.nativ.map((b) => b.key)));
    for (const b of w.nativ) blockZeile(b);
  }
  // was Claude Code von sich aus mitbringt und wie Fleet daran dreht
  const cc = a.claudeCode;
  if (cc) {
    out.push(unterkopf("Claude Code bringt selbst mit", cc.messung.gilt ? `gemessen ${fmt(cc.messung.tokens)}, ${cc.messung.am.slice(0, 10)}` : "nicht gemessen für diesen Start"));
    const grp = el("div", "k15grp");
    for (const z of cc.zeilen) {
      const r = el("div", "k15z");
      const vv = el("span", "k15zv");
      vv.append(el("span", "k15zt", z.wert), ...(istSchalter(z.weg) ? [] : [el("span", "k15zsub", z.weg)]));
      const x = el("span", "k15x");
      x.append(el("span", "", z.satz));
      x.title = istSchalter(z.weg) ? `Claude Code: ${z.weg} · ${z.quelle}` : z.quelle;
      vv.append(x);
      r.append(el("span", "k15zk", z.wort), vv);
      grp.append(r);
    }
    out.push(grp);
  }
  return out;
}

// K15 · SPALTE 4, DIE CONTEXT PACKS: was der Plan dieser Rolle an Packs wählt, deine Entwürfe und der Editor für einen neuen Pack
// (Modell: src/k15-kontextpack.ts). Ein Entwurf hat Name, Text und je Rolle einen Ort: als Text, auf Abruf oder nicht. Wo er dann
// landet, sagt der Plan jeder Rolle im gewählten Repo. Fleet legt heute keinen Pack an; der Entwurf liegt im Speicher des Fensters (src/k15-speicher.ts).
import { el, OMIT_SAY, PACK_WORDS } from "./k15-haupt";
import { icon } from "./icons";
import type { Answer } from "./founding";
import { DU, ORTE, tokVon, undListe } from "./k15-entwurf-modell";
import { PACK_ORTE, PACK_ROLLEN, istPackRolle, neuerPack, packBytes, packFehler, packLandung, type PackEntwurf, type PackLandung, type PackRolle } from "./k15-kontextpack";
import { antwort, gewaehlt, hole, lage, planUrl, render, speichereEigenes, toast, type St } from "./k15-zustand";
import { qLeiste, qTitel, schalt } from "./k15-teile";
import { setzeBaustein } from "./k15-spalte3";

const ortWort = (weg: string): string => ORTE.find((o) => o.weg === weg)?.wort ?? weg;
export const landungSatz = (la: PackLandung): string => la.art === "nicht" ? la.grund
  : `${la.ort === "text" ? "als Text" : "auf Abruf"} in den Lesehinweisen · ${ortWort(la.weg)}`;
// je Rolle der volle Plan im gewählten Repo: daraus folgt, wohin ihre Lesehinweise gehen
const planDer = (s: St, rolle: PackRolle): Answer | null => s.repo ? antwort(hole(s, planUrl(s.repo, rolle, {}))) : null;

function sichere(s: St, pk: PackEntwurf): void {
  const fehler = packFehler(pk);
  if (fehler) { toast(fehler); return; }
  const da = s.packs.find((x) => x.id === pk.id);
  const neu: PackEntwurf = { ...pk, name: pk.name.trim(), v: (da?.v ?? 0) + 1, am: Date.now(), autor: DU };
  s.packs = da ? s.packs.map((x) => x.id === pk.id ? neu : x) : [...s.packs, neu];
  s.packEdit = null;
  if (s.ablauf && !s.ablauf.packs.includes(neu.id)) s.ablauf.packs = [...s.ablauf.packs, neu.id];
  // „gesichert“ erst, wenn der Server bestätigt hat; schlägt es fehl, bleibt sein Satz stehen
  const wer = PACK_ROLLEN.filter((r) => neu.orte[r.id] !== "nicht").map((r) => r.wort);
  void speichereEigenes(s).then((ok) => { if (ok) toast(`„${neu.name}“ v${neu.v} ist als Entwurf gesichert und steht bei ${undListe(wer)} unter Wissen. Fleet gibt ihn heute noch nicht mit.`); });
  render();
}

// hat der offene Editor etwas, das ein Schließen verwürfe? (Prüfung Punkt 2)
export function packUngesichert(s: St): boolean {
  const pk = s.packEdit;
  if (!pk) return false;
  const da = s.packs.find((x) => x.id === pk.id);
  return da ? da.name !== pk.name || da.text !== pk.text || JSON.stringify(da.orte) !== JSON.stringify(pk.orte) : !!(pk.name.trim() || pk.text.trim());
}
// „Name“ bekommt den Fokus einmal, wenn ein neuer Pack aufgeht, nicht bei jedem Neuzeichnen (sonst tippte man plötzlich dort)
const fokussiert = new WeakSet<PackEntwurf>();
// DER EDITOR: Name, Text, und je Rolle, ob und wie der Pack mitgeht; darunter, wo er bei ihr landete
export function packEditor(s: St, pk: PackEntwurf): HTMLElement {
  const box = el("section", "k15packed");
  const neu = !s.packs.some((x) => x.id === pk.id);
  const kopf = el("div", "k15packk");
  kopf.append(el("span", "k15packn", neu ? "Neuer Kontextpack" : `Kontextpack · ${pk.name}`), el("span", "k15tag entw", "Entwurf"), ...(pk.v ? [el("span", "k15tag ver", `v${pk.v}`)] : []));
  box.append(kopf);
  const feld = (wort: string, f: HTMLInputElement | HTMLTextAreaElement) => {
    const l = el("label", "k15packf");
    l.append(el("span", "k15packl", wort), f);
    box.append(l);
  };
  const name = document.createElement("input");
  name.className = "k15packin";
  name.maxLength = 80;
  name.value = pk.name;
  name.placeholder = "z. B. Wie wir Commits schreiben";
  name.dataset.feld = "pk-name";
  name.oninput = () => { pk.name = name.value; };
  feld("Name", name);
  const text = document.createElement("textarea");
  text.className = "k15editt k15packt";
  text.value = pk.text;
  text.spellcheck = false;
  text.placeholder = "Was die Session zu diesem Thema wissen soll, in deinen Worten oder als Regel.";
  text.dataset.feld = "pk-text";
  text.oninput = () => { pk.text = text.value; };
  feld("Text", text);
  box.append(el("div", "k15packl k15packl2", "Geht mit bei"));
  for (const r of PACK_ROLLEN) {
    const z = el("div", "k15packr");
    z.dataset.rolle = r.id;
    const seg = el("div", "k15seg");
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", `${r.wort}: wie der Pack mitgeht`);
    for (const o of PACK_ORTE) {
      const b = el("button", pk.orte[r.id] === o.id ? "on" : "", o.wort);
      b.title = o.satz;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(pk.orte[r.id] === o.id));
      b.onclick = () => { pk.orte = { ...pk.orte, [r.id]: o.id }; render(); };
      seg.append(b);
    }
    const la = packLandung(pk, r.id, planDer(s, r.id));
    z.append(el("span", "k15packrw", r.wort), seg, el("span", `k15packrl${la.art === "nicht" ? " nicht" : ""}`, la.art === "mit" ? `→ ${landungSatz(la)}` : pk.orte[r.id] === "nicht" ? "" : la.grund));
    box.append(z);
  }
  box.append(el("div", "k15hinweis", "Fleet legt heute keinen Pack an: Dafür fehlt eine Route, die ihn ins Repo schreibt. Bis dahin bleibt er ein gespeicherter Entwurf, zeigt dir, wo er landete, und reist im vollständigen Export mit."));
  const knoepfe = el("div", "k15row2");
  const ok = el("button", "k15ghost k15editok", pk.v ? `Als v${pk.v + 1} sichern` : "Als Entwurf sichern");
  ok.onclick = () => sichere(s, pk);
  const ab = el("button", "k15ghost", "Abbrechen");
  ab.onclick = () => { s.packEdit = null; render(); };
  knoepfe.append(ok, ab);
  if (!neu) {
    const weg = el("button", "k15link k15loesch", "Löschen");
    let sicher = false;
    weg.onclick = () => {
      if (!sicher) { sicher = true; weg.textContent = "Wirklich löschen?"; setTimeout(() => { sicher = false; if (weg.isConnected) weg.textContent = "Löschen"; }, 4000); return; }
      s.packs = s.packs.filter((x) => x.id !== pk.id);
      s.packEdit = null;
      void speichereEigenes(s).then((ok) => { if (ok) toast(`„${pk.name}“ ist gelöscht.`); });
      render();
    };
    knoepfe.append(weg);
  }
  box.append(knoepfe);
  if (!fokussiert.has(pk)) { fokussiert.add(pk); requestAnimationFrame(() => { if (!pk.name) name.focus({ preventScroll: true }); }); }
  return box;
}

export function packsAnsicht(s: St, a: Answer | null, ohnePlan: () => HTMLElement): HTMLElement[] {
  const { q, p } = gewaehlt(s);
  const out = qTitel("Context Packs", null, "aus .fleet/context-packs.json des Repos · der Plan wählt sie nach Auslöser, Agent und Rolle", true);
  if (s.packEdit) out.push(packEditor(s, s.packEdit));
  else if (istPackRolle(p.rolle)) {
    const neu = el("button", "k15ghost k15packneu");
    neu.append(icon("plus"), el("span", "", "Neuer Kontextpack"));
    neu.onclick = () => { s.packEdit = neuerPack(p.rolle, DU, Date.now()); render(); };
    out.push(neu);
  }
  // DEINE ENTWÜRFE: je Pack, bei welchen Rollen er wie mitginge, und wo er bei der gewählten Session landete
  if (s.packs.length) {
    out.push(qLeiste(`Deine Entwürfe · ${s.packs.length}`, []));
    for (const pk of s.packs) {
      const la = packLandung(pk, p.rolle, a);
      const r = el("button", `k15packe${s.packEdit?.id === pk.id ? " on" : ""}`);
      r.dataset.pack = pk.id;
      const k = el("span", "k15packk");
      k.append(el("span", "k15packn", pk.name), el("span", "k15tag entw", "Entwurf"), el("span", "k15tag ver", `v${pk.v}`),
        ...(la.art === "mit" ? [el("span", "k15abst k15n", tokVon(packBytes(pk, la.ort)))] : []));
      const wer = PACK_ROLLEN.filter((x) => pk.orte[x.id] !== "nicht").map((x) => `${x.wort}: ${pk.orte[x.id] === "text" ? "als Text" : "auf Abruf"}`).join(" · ");
      r.append(k, el("span", "k15qd", wer), el("span", "k15qd", `${q ? q.name : `Profil ${p.name}`}: ${landungSatz(la)}`));
      r.onclick = () => { s.packEdit = structuredClone(pk); render(); };
      out.push(r);
    }
  }
  if (!a) { out.push(ohnePlan()); return out; }
  const packs = a.plan.bausteine.filter((b) => b.id.startsWith("pack:"));
  if (!packs.length) { out.push(el("div", "k15leer", "Der Plan dieser Rolle kennt keine Packs.")); return out; }
  const an = packs.filter((b) => b.zustand === "an");
  out.push(qLeiste(`Aus dem Repo · ${an.length} von ${packs.length} gehen mit`, []));
  const l = lage(s, p, q);
  for (const b of [...an, ...packs.filter((x) => x.zustand !== "an")]) {
    const id = b.id.slice(5);
    const sel = a.selected.find((x) => x.id === id);
    const om = a.omitted.find((x) => x.id === id);
    const key = `pk:${id}`;
    const offen = s.offen.has(key);
    const r = el("div", `k15abs${offen ? " open" : ""}${b.zustand === "an" ? "" : " aus"}`);
    const kopf = el("button", "k15absh");
    kopf.setAttribute("aria-expanded", String(offen));
    kopf.append(icon("chevron"), el("span", "k15absn", PACK_WORDS[id]?.name ?? id),
      b.zustand === "an" ? el("span", "k15abst k15n", typeof b.bytes === "number" ? tokVon(b.bytes) : "")
        : el("span", "k15abst", om ? OMIT_SAY[om.reason] ?? om.reason : b.quelle === "schalter" ? "ausgeschaltet" : "aus"));
    kopf.onclick = () => { if (offen) s.offen.delete(key); else s.offen.add(key); render(); };
    r.append(kopf);
    if (l) {
      const frei = b.schaltbar.ja && (b.zustand === "an" || !om);
      const sw = schalt(b.zustand === "an", frei ? `${PACK_WORDS[id]?.name ?? id} ${b.zustand === "an" ? "an" : "aus"}` : `${PACK_WORDS[id]?.name ?? id}: ${om ? OMIT_SAY[om.reason] ?? om.reason : "nicht schaltbar"}`,
        () => { if (frei) void setzeBaustein(s, q, p, b, b.zustand !== "an"); });
      if (!frei) sw.classList.add("fest");
      r.append(sw);
    }
    if (offen) {
      const body = el("div", "k15absb");
      body.append(el("div", "k15qd", PACK_WORDS[id]?.say ?? sel?.useWhen ?? b.satz));
      for (const part of sel?.parts ?? []) {
        body.append(el("div", "k15qp", `${part.path ?? ""}${part.anchor ? ` · ${part.anchor}` : ""}`));
        body.append(el("pre", "k15pre", part.content ?? (part.privateSourceId ? "Privat: der Text kommt nie in die Datei, nur sein Hinweis." : part.ort === "ausleihe" ? "Auf Abruf: dort steht nur der Hinweis." : "Text an diesem Stand nicht lesbar.")));
      }
      r.append(body);
    }
    out.push(r);
  }
  return out;
}
